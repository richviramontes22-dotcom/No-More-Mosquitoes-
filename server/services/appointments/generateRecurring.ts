import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { supabase } from "../../lib/supabase";

const db = supabaseAdmin ?? supabase;

// Days in advance to generate the next appointment.
// An appointment is created when next_due_date <= today + ADVANCE_DAYS.
const ADVANCE_DAYS = 7;

// When looking for a slot, search up to this many days past the due date.
const SLOT_SEARCH_WINDOW = 14;

// Set APPOINTMENT_GEN_DRY_RUN=true to log what would be created without writing.
const DRY_RUN = process.env.APPOINTMENT_GEN_DRY_RUN === "true";

export interface GenerationResult {
  checked: number;
  generated: number;
  skipped: number;
  failed: number;
  noSlotFound: number;
  errors: string[];
  dryRun?: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return toDateStr(d);
}

// ── Main export ────────────────────────────────────────────────────────────────

/**
 * Scans all active recurring subscriptions and generates the next appointment
 * for any that have no future appointment scheduled and whose next due date
 * falls within the ADVANCE_DAYS lookahead window.
 *
 * Idempotent: will not create a duplicate if a future appointment already exists.
 */
export async function runRecurringGeneration(): Promise<GenerationResult> {
  const result: GenerationResult = {
    checked: 0, generated: 0, skipped: 0, failed: 0, noSlotFound: 0, errors: [], dryRun: DRY_RUN,
  };

  const today  = toDateStr(new Date());
  const cutoff = addDays(today, ADVANCE_DAYS);

  try {
    // 1. All active subscriptions with cadence_days set and a property_id
    const { data: subs, error: subErr } = await db
      .from("subscriptions")
      .select("id, user_id, property_id, cadence_days, current_period_end")
      .eq("status", "active")
      .not("property_id", "is", null)
      .not("cadence_days", "is", null);

    if (subErr) {
      result.errors.push(`Subscription query failed: ${subErr.message}`);
      return result;
    }

    if (!subs?.length) return result;
    result.checked = subs.length;

    // 2. Batch-load property programs and service_preferences
    const propertyIds = [...new Set((subs as any[]).map((s) => s.property_id))];

    const { data: properties } = await db
      .from("properties")
      .select("id, program, service_preferences")
      .in("id", propertyIds);

    const propMap: Record<string, { program?: string; service_preferences?: any }> = {};
    (properties || []).forEach((p: any) => { propMap[p.id] = p; });

    for (const sub of subs as any[]) {
      try {
        const prop      = propMap[sub.property_id] ?? {};
        const program   = prop.program ?? "subscription";

        // Skip one-time programs entirely — no recurring generation
        if (program === "one_time") {
          result.skipped++;
          continue;
        }
        // Annual plans: only generate appointments while the paid period is active.
        // current_period_end is stored on the subscription row set at checkout.
        if (program === "annual") {
          const periodEnd = sub.current_period_end ? new Date(sub.current_period_end) : null;
          if (!periodEnd || periodEnd <= new Date()) {
            result.skipped++;
            continue;
          }
        }

        const cadenceDays: number = parseInt(String(sub.cadence_days), 10);
        if (!cadenceDays || cadenceDays <= 0) {
          result.skipped++;
          continue;
        }

        // 3. Guard: skip if a future appointment already exists (idempotency)
        const { count: futureCount } = await db
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("property_id", sub.property_id)
          .eq("user_id", sub.user_id)
          .gte("scheduled_date", today)
          .not("status", "in", '("canceled","cancelled","canceled_by_admin","canceled_by_customer")');

        if ((futureCount ?? 0) > 0) {
          result.skipped++;
          continue;
        }

        // 4. Find the last non-canceled appointment for this property (anchor date)
        const { data: lastAppts } = await db
          .from("appointments")
          .select("scheduled_date")
          .eq("property_id", sub.property_id)
          .eq("user_id", sub.user_id)
          .not("status", "in", '("canceled","cancelled","canceled_by_admin","canceled_by_customer")')
          .order("scheduled_date", { ascending: false })
          .limit(1);

        if (!lastAppts?.length) {
          // No prior appointment to anchor from — needs manual scheduling
          result.skipped++;
          continue;
        }

        const lastDate = (lastAppts[0] as any).scheduled_date as string;
        const nextDue  = addDays(lastDate, cadenceDays);

        // 5. Only generate if next due falls within the advance window
        if (nextDue > cutoff) {
          result.skipped++;
          continue;
        }

        // 6. Resolve customer preferences
        const prefs          = prop.service_preferences ?? {};
        const preferredDays: number[] = Array.isArray(prefs.preferred_days_of_week) ? prefs.preferred_days_of_week : [];
        const preferredWins: string[] = Array.isArray(prefs.preferred_windows)       ? prefs.preferred_windows       : [];

        // 7. Find a slot on or after nextDue (respecting business hours, blackouts, capacity)
        const slot = await findAvailableSlot(nextDue, today, preferredDays, preferredWins);

        if (!slot) {
          result.noSlotFound++;
          result.errors.push(
            `No slot for property=${sub.property_id} sub=${sub.id} nextDue=${nextDue} — needs manual scheduling`,
          );

          // Create an admin-visible ticket for the scheduling failure (deduped per day)
          try {
            const today2 = toDateStr(new Date());
            const alertSubject = `Scheduling: no slot found for subscription ${sub.id}`;
            const { data: existingTicket } = await db
              .from("tickets")
              .select("id")
              .eq("subject", alertSubject)
              .gte("created_at", `${today2}T00:00:00Z`)
              .maybeSingle();

            if (!existingTicket) {
              await db.from("tickets").insert({
                subject:     alertSubject,
                description: `Recurring appointment could not be scheduled. Subscription: ${sub.id}, Property: ${sub.property_id}, Cadence: ${sub.cadence_days} days, NextDue: ${nextDue}.`,
                status:      "open",
                priority:    "high",
                user_id:     sub.user_id,
                created_at:  new Date().toISOString(),
              });
            }
          } catch (alertErr: any) {
            console.error("[recurring] Failed to create scheduling alert:", alertErr.message);
          }

          continue;
        }

        if (DRY_RUN) {
          console.log(
            `[RecurringGen:DryRun] Would create: property=${sub.property_id} user=${sub.user_id}` +
            ` date=${slot.date} window=${slot.windowId} (nextDue was ${nextDue})`,
          );
          result.generated++;
          continue;
        }

        // 8. Insert the appointment
        const { error: insertErr } = await db.from("appointments").insert({
          user_id:        sub.user_id,
          property_id:    sub.property_id,
          status:         "scheduled",
          service_type:   "Mosquito Service",
          scheduled_date: slot.date,
          window:         slot.windowId,
          window_label:   slot.windowLabel,
          scheduled_at:   `${slot.date}T${slot.windowStart}:00`,
          notes:          null,
        });

        if (insertErr) {
          result.failed++;
          result.errors.push(`Insert failed sub=${sub.id}: ${insertErr.message}`);
        } else {
          result.generated++;
          console.log(
            `[RecurringGen] Created: property=${sub.property_id} date=${slot.date}` +
            ` window=${slot.windowId} (nextDue was ${nextDue})`,
          );
        }
      } catch (err: any) {
        result.failed++;
        result.errors.push(`Error on sub=${sub.id}: ${err.message}`);
      }
    }
  } catch (err: any) {
    result.errors.push(`Fatal error: ${err.message}`);
  }

  return result;
}

// ── Slot finder ────────────────────────────────────────────────────────────────

interface Slot {
  date:        string;
  windowId:    string;
  windowLabel: string;
  windowStart: string;
}

/**
 * Searches for the first available appointment slot starting at `startDate`,
 * up to SLOT_SEARCH_WINDOW days later.
 *
 * Respects:
 *  - Business hours (is_operational, windows, max_jobs_per_tech)
 *  - Blackout dates
 *  - Current booked count vs technician capacity
 *  - Customer's preferred days and windows (soft preference — retried without if needed)
 */
async function findAvailableSlot(
  startDate:       string,
  today:           string,
  preferredDays:   number[],
  preferredWins:   string[],
): Promise<Slot | null> {
  const searchFrom  = startDate < today ? today : startDate;
  const searchUntil = addDays(startDate, SLOT_SEARCH_WINDOW);

  // Business hours (global only)
  const { data: hoursRows } = await db
    .from("business_hours")
    .select("day_of_week, is_operational, windows")
    .is("service_area_id", null);

  if (!hoursRows?.length) return null;

  const hoursByDay: Record<number, any> = {};
  (hoursRows as any[]).forEach((r) => { hoursByDay[r.day_of_week] = r; });

  // Blackout dates in range
  const { data: blackouts } = await db
    .from("blackout_dates")
    .select("date")
    .gte("date", searchFrom)
    .lte("date", searchUntil);
  const blackoutSet = new Set((blackouts || []).map((b: any) => b.date));

  // Booked appointments in range
  const { data: booked } = await db
    .from("appointments")
    .select("scheduled_date, window")
    .gte("scheduled_date", searchFrom)
    .lte("scheduled_date", searchUntil)
    .in("status", ["requested", "scheduled", "confirmed"]);

  const bookedMap: Record<string, Record<string, number>> = {};
  for (const row of booked || []) {
    const r = row as any;
    if (!r.scheduled_date || !r.window) continue;
    if (!bookedMap[r.scheduled_date]) bookedMap[r.scheduled_date] = {};
    bookedMap[r.scheduled_date][r.window] = (bookedMap[r.scheduled_date][r.window] || 0) + 1;
  }

  // Active technician count for capacity
  const { data: techs } = await db.from("employees").select("id").eq("status", "active");
  const techCount = techs?.length || 1;

  // Walk days
  const cursor = new Date(searchFrom + "T00:00:00Z");
  const end    = new Date(searchUntil + "T00:00:00Z");

  while (cursor <= end) {
    const dateStr   = toDateStr(cursor);
    const dayOfWeek = cursor.getUTCDay();
    cursor.setUTCDate(cursor.getUTCDate() + 1);

    if (blackoutSet.has(dateStr)) continue;

    const hours = hoursByDay[dayOfWeek];
    if (!hours?.is_operational || !hours?.windows?.length) continue;

    // Respect preferred days (soft — skip for now, retry without pref if needed)
    if (preferredDays.length > 0 && !preferredDays.includes(dayOfWeek)) continue;

    for (const win of hours.windows as any[]) {
      const capacity  = techCount * (win.max_jobs_per_tech ?? 3);
      const bookedCnt = bookedMap[dateStr]?.[win.id] ?? 0;
      if (bookedCnt >= capacity) continue;

      // Respect preferred windows
      if (preferredWins.length > 0 && !preferredWins.includes(win.id)) continue;

      return {
        date:        dateStr,
        windowId:    win.id,
        windowLabel: win.label ?? win.id,
        windowStart: win.start ?? "08:00",
      };
    }
  }

  // Retry without preferences if they narrowed out all results
  if (preferredDays.length > 0 || preferredWins.length > 0) {
    return findAvailableSlot(startDate, today, [], []);
  }

  return null;
}
