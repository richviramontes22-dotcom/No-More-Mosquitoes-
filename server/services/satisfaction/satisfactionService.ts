import { supabase } from "../../lib/supabase";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { notifyAdmin } from "../notifications/adminNotificationService";

const db = supabaseAdmin ?? supabase;

export type SatisfactionType = "promoter" | "passive" | "detractor";

export interface SatisfactionSurvey {
  id: string;
  appointment_id: string;
  profile_id: string;
  rating: number;
  satisfaction_type: SatisfactionType;
  comment: string | null;
  issue_category: string | null;
  followup_required: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  ticket_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubmitSurveyParams {
  appointmentId: string;
  profileId: string;
  rating: number;
  comment?: string | null;
  issueCategory?: string | null;
}

/**
 * Pure classification rule — 9-10 promoter, 7-8 passive, 0-6 detractor.
 * Must exactly match classify_satisfaction_survey() in
 * db/migrations/2026-06-19_customer_satisfaction_nps.sql. The DB trigger is
 * the authoritative enforcement in production (it overwrites whatever is
 * inserted, including this function's output) — this export exists so the
 * rule itself is independently unit-testable without a live Postgres
 * trigger, and so submitSurvey() can pass a correct value through even
 * against a test double that has no trigger support.
 */
export function classifySatisfactionRating(rating: number): SatisfactionType {
  if (rating >= 9) return "promoter";
  if (rating >= 7) return "passive";
  return "detractor";
}

/**
 * Submits a satisfaction survey for a completed appointment. The DB trigger
 * (classify_satisfaction_survey) is the source of truth for satisfaction_type
 * in production — this function never trusts a client-supplied
 * classification, only a raw 0-10 rating, and computes the same
 * classification itself (via classifySatisfactionRating) so behavior is
 * identical whether or not the trigger fires. Detractors automatically get
 * an admin alert and a service_quality support ticket; promoters/passives
 * do not.
 *
 * Returns { error: "already_submitted" } if a survey already exists for
 * this appointment (the DB UNIQUE constraint is the actual enforcement;
 * this just turns the resulting Postgres error into a clean signal).
 */
export async function submitSurvey(
  params: SubmitSurveyParams,
): Promise<{ survey: SatisfactionSurvey | null; error?: string }> {
  // Check first, not just rely on the DB UNIQUE constraint catching a
  // duplicate — gives a predictable error path independent of driver-level
  // error codes, and is the property this function's tests exercise
  // directly. The DB constraint remains as a defense-in-depth backstop
  // against the small race window between this check and the insert.
  const { data: existing } = await db
    .from("customer_satisfaction_surveys")
    .select("id")
    .eq("appointment_id", params.appointmentId)
    .maybeSingle();
  if (existing) return { survey: null, error: "already_submitted" };

  const satisfactionType = classifySatisfactionRating(params.rating);
  const { data, error } = await db
    .from("customer_satisfaction_surveys")
    .insert({
      appointment_id: params.appointmentId,
      profile_id: params.profileId,
      rating: params.rating,
      satisfaction_type: satisfactionType,
      followup_required: satisfactionType === "detractor",
      comment: params.comment ?? null,
      issue_category: params.issueCategory ?? null,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") return { survey: null, error: "already_submitted" };
    return { survey: null, error: error.message };
  }

  const survey = data as SatisfactionSurvey;

  if (survey.satisfaction_type === "detractor") {
    void handleDetractor(survey);
  }

  return { survey };
}

// A detractor follow-up is time-sensitive — the customer is unhappy right
// after service, not next week. 48 hours is a reasonable SLA for a first
// outreach; not configurable today since nothing else in this codebase has
// asked for that yet.
const DETRACTOR_FOLLOWUP_SLA_HOURS = 48;

async function handleDetractor(survey: SatisfactionSurvey): Promise<void> {
  try {
    const { data: profile } = await db.from("profiles").select("name, email").eq("id", survey.profile_id).maybeSingle();

    // Assign to customer_service staff if any exist; otherwise the ticket
    // stays unassigned and falls into the admin queue — notifyAdmin() below
    // is what "admin queue" means in practice, since there's no dedicated
    // unassigned-ticket inbox separate from admin notifications today.
    // customer_service staff are profiles-only (no employees table row —
    // see Dashboard.tsx's own comment on this), so this looks up profiles
    // directly, not employees. No workload-balancing exists; picks
    // whichever active customer_service profile sorts first, which is fine
    // at the realistic scale of "zero or one" today.
    const { data: csProfile } = await db
      .from("profiles")
      .select("id, name")
      .eq("role", "customer_service")
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();

    const dueAt = new Date(Date.now() + DETRACTOR_FOLLOWUP_SLA_HOURS * 60 * 60 * 1000).toISOString();

    notifyAdmin({
      event_type: "satisfaction.detractor_reported",
      severity: "warning",
      title: `Detractor satisfaction rating (${survey.rating}/10)`,
      body: `${profile?.name || "A customer"} rated a completed service ${survey.rating}/10.${survey.comment ? ` Comment: "${survey.comment}"` : ""} ${csProfile ? `Assigned to ${csProfile.name}.` : "No customer service staff available — routed to admin queue."} Due ${new Date(dueAt).toLocaleString()}.`,
      entity_type: "customer_satisfaction_survey",
      entity_id: survey.id,
      metadata: { appointment_id: survey.appointment_id, rating: survey.rating, issue_category: survey.issue_category, assigned_to: csProfile?.id ?? null, due_at: dueAt },
    });

    const { data: ticket, error: ticketErr } = await db
      .from("tickets")
      .insert({
        user_id: survey.profile_id,
        subject: `Low satisfaction rating (${survey.rating}/10) — follow-up needed`,
        description: survey.comment || "Customer left a low satisfaction rating with no additional comment.",
        category: "service_quality",
        priority: "high",
        status: "open",
        assigned_to: csProfile?.id ?? null,
        due_at: dueAt,
      })
      .select("id")
      .single();

    if (!ticketErr && ticket) {
      await db.from("customer_satisfaction_surveys").update({ ticket_id: ticket.id }).eq("id", survey.id);
    }

    // This function only ever creates an internal ticket and an admin
    // notification — it must never message the customer directly. If that
    // ever changes, it needs to be a deliberate, separate, staff-initiated
    // action, not something that happens automatically here.
  } catch (err: any) {
    console.error("[satisfactionService] handleDetractor failed:", err.message);
  }
}

export async function resolveSatisfactionIssue(
  surveyId: string,
  resolvedBy: string | null,
): Promise<SatisfactionSurvey | null> {
  const { data, error } = await db
    .from("customer_satisfaction_surveys")
    .update({ resolved_at: new Date().toISOString(), resolved_by: resolvedBy })
    .eq("id", surveyId)
    .select("*")
    .single();

  if (error) return null;
  return data as SatisfactionSurvey;
}

export interface DetractorPending extends SatisfactionSurvey {
  due_at: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
}

export interface SatisfactionDashboard {
  nps_score: number | null;
  total_responses: number;
  promoter_count: number;
  passive_count: number;
  detractor_count: number;
  detractors_pending: DetractorPending[];
}

/**
 * NPS = %promoters - %detractors, the standard formula. Returns null (not
 * 0) when there are zero responses — a 0 score implies a measured neutral
 * result, which "no data yet" is not.
 */
export async function getSatisfactionDashboard(): Promise<SatisfactionDashboard> {
  const { data: surveys } = await db.from("customer_satisfaction_surveys").select("*").order("created_at", { ascending: false });
  const rows = (surveys ?? []) as SatisfactionSurvey[];

  const promoterCount = rows.filter((r) => r.satisfaction_type === "promoter").length;
  const passiveCount = rows.filter((r) => r.satisfaction_type === "passive").length;
  const detractorCount = rows.filter((r) => r.satisfaction_type === "detractor").length;
  const total = rows.length;

  const npsScore = total > 0 ? Math.round(((promoterCount - detractorCount) / total) * 100) : null;

  const pendingRows = rows.filter((r) => r.satisfaction_type === "detractor" && r.followup_required && !r.resolved_at);

  // Enrich with the linked ticket's due date and assignee — the
  // "follow-up task" half of this isn't on the survey row itself, it's on
  // the ticket handleDetractor() created alongside it.
  const ticketIds = pendingRows.map((r) => r.ticket_id).filter((id): id is string => !!id);
  const ticketMap: Record<string, { due_at: string | null; assigned_to: string | null }> = {};
  if (ticketIds.length > 0) {
    const { data: tickets } = await db.from("tickets").select("id, due_at, assigned_to").in("id", ticketIds);
    (tickets ?? []).forEach((t: any) => { ticketMap[t.id] = { due_at: t.due_at, assigned_to: t.assigned_to }; });
  }

  const assigneeIds = [...new Set(Object.values(ticketMap).map((t) => t.assigned_to).filter((id): id is string => !!id))];
  const assigneeNames: Record<string, string> = {};
  if (assigneeIds.length > 0) {
    const { data: assignees } = await db.from("profiles").select("id, name").in("id", assigneeIds);
    (assignees ?? []).forEach((a: any) => { assigneeNames[a.id] = a.name; });
  }

  const detractorsPending: DetractorPending[] = pendingRows.map((r) => {
    const ticket = r.ticket_id ? ticketMap[r.ticket_id] : null;
    return {
      ...r,
      due_at: ticket?.due_at ?? null,
      assigned_to: ticket?.assigned_to ?? null,
      assigned_to_name: ticket?.assigned_to ? assigneeNames[ticket.assigned_to] ?? null : null,
    };
  });

  return {
    nps_score: npsScore,
    total_responses: total,
    promoter_count: promoterCount,
    passive_count: passiveCount,
    detractor_count: detractorCount,
    detractors_pending: detractorsPending,
  };
}
