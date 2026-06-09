import { Router } from "express";
import { supabase } from "../lib/supabase";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { isEmailConfigured } from "../services/notifications/resendClient";
import { getEmailProvider, getFromEmail } from "../services/notifications/providers/index";
import { buildServiceCompletionEmail, buildEnRouteFallbackEmail } from "../services/notifications/emailTemplates";
import { logNotification } from "../services/notifications/notificationLogger";
import { notifyAdmin } from "../services/notifications/adminNotificationService";

const router = Router();

// Service role for DB reads/writes — employee identity validated via JWT below.
const db = supabaseAdmin ?? supabase;

// "assigned" is intentionally excluded: it is NOT in the DB CHECK constraint
// (see 2025-11-10_employee_portal.sql). The initial assignment status written
// by the admin is "scheduled". Allowing employees to set "assigned" via the
// API would cause a DB-level CHECK violation.
const VALID_STATUSES = ["en_route", "in_progress", "completed", "no_show", "skipped"] as const;
type AssignmentStatus = (typeof VALID_STATUSES)[number];

/**
 * Resolves the authenticated employee record from the Bearer JWT.
 * Returns null if unauthenticated or employee record not found.
 */
async function getAuthenticatedEmployee(req: any): Promise<{ userId: string; employeeId: string; isTest: boolean } | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return null;

  const { data: emp } = await db
    .from("employees")
    .select("id, is_test")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!emp) return null;
  return { userId: user.id, employeeId: emp.id, isTest: (emp as any).is_test ?? false };
}

/**
 * GET /api/employee/assignments
 * Returns today's assignments for the authenticated employee,
 * enriched with appointment, customer, and property data.
 */
router.get("/assignments", async (req, res) => {
  const actor = await getAuthenticatedEmployee(req);
  if (!actor) return res.status(401).json({ error: "Unauthorized" });

  const { date } = req.query as Record<string, string>;
  const targetDate = date || new Date().toISOString().slice(0, 10);
  const dayStart = `${targetDate}T00:00:00`;
  const dayEnd   = `${targetDate}T23:59:59`;

  try {
    const { data: rows, error } = await db
      .from("assignments")
      .select(`
        id,
        status,
        en_route_at,
        arrived_at,
        started_at,
        completed_at,
        appointment_id,
        appointments!inner (
          scheduled_at,
          service_type,
          notes,
          user_id,
          property_id
        )
      `)
      .eq("employee_id", actor.employeeId)
      .gte("appointments.scheduled_at", dayStart)
      .lte("appointments.scheduled_at", dayEnd)
      .order("appointments.scheduled_at", { ascending: true });

    if (error) {
      console.error("[EmployeeAssignments] Query error:", error.message);
      return res.status(500).json({ error: "Failed to load assignments" });
    }

    if (!rows || rows.length === 0) return res.json([]);

    // Batch-enrich with customer and property data
    const userIds = [...new Set((rows as any[]).map((r: any) => r.appointments?.user_id).filter(Boolean))];
    const propIds = [...new Set((rows as any[]).map((r: any) => r.appointments?.property_id).filter(Boolean))];

    const [profilesRes, propsRes] = await Promise.all([
      userIds.length > 0
        ? db.from("profiles").select("id, name, phone").in("id", userIds)
        : { data: [], error: null },
      propIds.length > 0
        ? db.from("properties").select("id, address, city, zip").in("id", propIds)
        : { data: [], error: null },
    ]);

    const profileMap: Record<string, { name: string; phone: string | null }> = {};
    (profilesRes.data || []).forEach((p: any) => { profileMap[p.id] = { name: p.name, phone: p.phone }; });

    const propMap: Record<string, { address: string; city: string | null; zip: string }> = {};
    (propsRes.data || []).forEach((p: any) => { propMap[p.id] = { address: p.address, city: p.city, zip: p.zip }; });

    const enriched = (rows as any[]).map((row: any) => {
      const appt    = row.appointments || {};
      const profile = profileMap[appt.user_id] ?? { name: "Customer", phone: null };
      const prop    = propMap[appt.property_id] ?? { address: null, city: null, zip: null };
      return {
        id:             row.id,
        status:         row.status || "assigned",
        en_route_at:    row.en_route_at ?? null,
        arrived_at:     row.arrived_at ?? null,
        started_at:     row.started_at ?? null,
        completed_at:   row.completed_at ?? null,
        appointment_id: row.appointment_id,
        scheduled_at:   appt.scheduled_at ?? null,
        service_type:   appt.service_type || "Mosquito Service",
        notes:          appt.notes ?? null,
        address:        prop.address ?? null,
        city:           prop.city ?? null,
        zip:            prop.zip ?? null,
        customer_name:  profile.name || "Customer",
        customer_phone: profile.phone ?? null,
      };
    });

    return res.json(enriched);
  } catch (err: any) {
    console.error("[EmployeeAssignments] Unexpected error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/employee/assignments/:id
 * Returns a single assignment with full context.
 */
router.get("/assignments/:id", async (req, res) => {
  const actor = await getAuthenticatedEmployee(req);
  if (!actor) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.params;

  try {
    const { data: row, error } = await db
      .from("assignments")
      .select("id, status, en_route_at, arrived_at, started_at, completed_at, appointment_id, employee_id")
      .eq("id", id)
      .single();

    if (error || !row) return res.status(404).json({ error: "Assignment not found" });

    // Ownership check — employees can only view their own assignments
    if (row.employee_id !== actor.employeeId) {
      return res.status(403).json({ error: "Not authorized to view this assignment" });
    }

    // Blocking onboarding check — test employees skip this
    if (!actor.isTest) {
      const { data: blockingForms } = await db
        .from("employee_onboarding_assignments")
        .select("id, onboarding_forms!inner(name, blocks_assignments)")
        .eq("employee_id", actor.employeeId)
        .eq("status", "pending")
        .eq("onboarding_forms.blocks_assignments", true);

      if (blockingForms && blockingForms.length > 0) {
        const formNames = (blockingForms as any[]).map((f) => (f.onboarding_forms as any)?.name).filter(Boolean);
        return res.status(403).json({
          error: "Onboarding incomplete",
          message: `Please complete required onboarding forms before accessing assignments.`,
          blocking_forms: formNames,
          redirect_to: "/employee/onboarding",
        });
      }
    }

    return res.json(row);
  } catch (err: any) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/employee/assignments/:id/status
 * Updates an assignment status and records lifecycle timestamps.
 * Validates assignment ownership before any write.
 * Optionally captures GPS snapshot (latitude, longitude, accuracy) if employee has consent.
 */
router.post("/assignments/:id/status", async (req, res) => {
  const actor = await getAuthenticatedEmployee(req);
  if (!actor) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.params;
  const { status, latitude, longitude, accuracy } = req.body ?? {};

  if (!status || !VALID_STATUSES.includes(status as AssignmentStatus)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` });
  }

  try {
    // Fetch current row to verify ownership and existing timestamps
    const { data: current, error: fetchErr } = await db
      .from("assignments")
      .select("id, employee_id, status, en_route_at, arrived_at, started_at, completed_at")
      .eq("id", id)
      .single();

    if (fetchErr || !current) return res.status(404).json({ error: "Assignment not found" });
    if (current.employee_id !== actor.employeeId) {
      return res.status(403).json({ error: "Not authorized to update this assignment" });
    }

    const now = new Date().toISOString();
    const update: Record<string, string | null> = { status };

    // Set lifecycle timestamps only on first transition — never overwrite
    if (status === "en_route"    && !current.en_route_at)  update.en_route_at  = now;
    if (status === "in_progress" && !current.started_at)   update.started_at   = now;
    if (status === "completed"   && !current.completed_at) update.completed_at = now;

    const { data: updated, error: updateErr } = await db
      .from("assignments")
      .update(update)
      .eq("id", id)
      .select("id, status, en_route_at, arrived_at, started_at, completed_at, appointment_id")
      .single();

    if (updateErr) {
      console.error("[EmployeeAssignments] Status update failed:", updateErr.message);
      return res.status(500).json({ error: "Failed to update assignment status" });
    }

    // En-route fallback email — send if customer has no phone number (suppressed for test employees)
    if (status === "en_route" && (updated as any)?.appointment_id && !actor.isTest) {
      (async () => {
        try {
          const appointmentId = (updated as any).appointment_id as string;
          const { data: apptData } = await db
            .from("appointments")
            .select("user_id, property_id, scheduled_date, window_label, window")
            .eq("id", appointmentId)
            .maybeSingle();

          if (!apptData?.user_id) return;

          const [profileResult, propertyResult] = await Promise.all([
            db.from("profiles").select("email, name, phone").eq("id", apptData.user_id).maybeSingle(),
            apptData.property_id
              ? db.from("properties").select("address, city, state").eq("id", apptData.property_id).maybeSingle()
              : Promise.resolve({ data: null }),
          ]);

          const profile  = profileResult.data;
          const property = (propertyResult as any).data;

          if (!profile?.email) return;

          const hasPhone = !!(profile as any).phone;
          if (hasPhone) {
            // Customer has a phone — SMS would be the preferred channel (handled elsewhere)
            console.log(`[en_route] Customer has phone — SMS is preferred channel for appointment ${appointmentId}`);
            return;
          }

          // No phone: send fallback email
          const addressParts = [property?.address, property?.city, property?.state].filter(Boolean);
          const dashboardUrl  = `${process.env.APP_BASE_URL || "https://nomoremosquitoes.us"}/dashboard/appointments`;
          const customerName  = (profile as any).name || profile.email.split("@")[0];
          const windowLabel   = apptData.window_label || apptData.window || "your arrival window";
          const scheduledDate = apptData.scheduled_date
            ? new Date(apptData.scheduled_date + "T00:00:00").toLocaleDateString("en-US", {
                weekday: "long", month: "long", day: "numeric", year: "numeric",
              })
            : "today";

          const { subject, html, text } = buildEnRouteFallbackEmail({
            customerName,
            windowLabel,
            propertyAddress: addressParts.join(", ") || "your property",
            scheduledDate,
            dashboardUrl,
          });

          const emailProvider = getEmailProvider();
          await emailProvider.send({ to: profile.email, from: getFromEmail(), subject, html, text });

          await logNotification({
            profileId:        apptData.user_id,
            appointmentId,
            recipientEmail:   profile.email,
            channel:          "email",
            notificationType: "technician_en_route",
            subject,
            status:           "sent",
            provider:         "resend",
            sentAt:           new Date().toISOString(),
          });

          console.log(`[en_route] Fallback email sent to ${profile.email} for appointment ${appointmentId}`);
        } catch (enRouteErr: any) {
          console.error("[en_route] Fallback email error:", enRouteErr.message);
        }
      })();
    }

    // Cascade completion to the linked appointment so the customer dashboard
    // reflects the finished visit without any admin intervention.
    if (status === "completed" && (updated as any)?.appointment_id) {
      const { error: apptErr } = await db
        .from("appointments")
        .update({ status: "completed" })
        .eq("id", (updated as any).appointment_id)
        .not("status", "in", '("completed","canceled","cancelled","canceled_by_admin","canceled_by_customer")');

      if (apptErr) {
        console.error(`[EmployeeAssignments] Appointment cascade failed for ${(updated as any).appointment_id}:`, apptErr.message);
      } else {
        console.log(`[EmployeeAssignments] Appointment ${(updated as any).appointment_id} → completed (cascaded from assignment ${id})`);
      }
    }

    // Notify customer when service is marked complete (non-fatal fire-and-forget)
    // Suppressed for test employees — they must use test fixture appointments, not real customer data
    if (status === "completed" && !actor.isTest) {
      (async () => {
        try {
          const { data: apptData } = await db
            .from("appointments")
            .select("user_id, scheduled_date, service_type")
            .eq("id", (updated as any)?.appointment_id)
            .maybeSingle();

          if (apptData?.user_id) {
            const { data: profile } = await db
              .from("profiles")
              .select("email, name")
              .eq("id", apptData.user_id)
              .maybeSingle();

            if (profile?.email) {
              // Check if job media was attached
              const { data: mediaItems } = await db
                .from("job_media")
                .select("id")
                .eq("assignment_id", id)
                .limit(1);
              const hasMedia = (mediaItems?.length ?? 0) > 0;

              // Log completion notification intent
              console.log(
                `[completion] Service complete for ${profile.email}` +
                ` — date=${apptData.scheduled_date}${hasMedia ? ", media available" : ""}`,
              );

              // Send service completion email using centralized template
              if (isEmailConfigured()) {
                try {
                  const customerName  = (profile as any).name || profile.email.split("@")[0];
                  const dashboardUrl  = `${process.env.APP_BASE_URL || "https://nomoremosquitoes.us"}/dashboard/appointments`;
                  const { subject, html, text } = buildServiceCompletionEmail({
                    customerName,
                    scheduledDate: apptData.scheduled_date ?? null,
                    hasMedia,
                    dashboardUrl,
                  });

                  const emailProvider = getEmailProvider();
                  await emailProvider.send({ to: profile.email, from: getFromEmail(), subject, html, text });
                  console.log(`[completion] Email sent to ${profile.email}`);

                  await logNotification({
                    profileId:        apptData.user_id,
                    appointmentId:    (updated as any)?.appointment_id ?? null,
                    recipientEmail:   profile.email,
                    channel:          "email",
                    notificationType: "service_completed",
                    subject,
                    status:           "sent",
                    provider:         "resend",
                    sentAt:           new Date().toISOString(),
                  });
                } catch (emailErr: any) {
                  console.error("[completion] Email send failed:", emailErr.message);
                  await logNotification({
                    profileId:        apptData.user_id,
                    appointmentId:    (updated as any)?.appointment_id ?? null,
                    recipientEmail:   profile.email,
                    channel:          "email",
                    notificationType: "service_completed",
                    status:           "failed",
                    provider:         "resend",
                    errorMessage:     emailErr.message,
                  });
                }
              } else {
                // Log skipped notification
                await Promise.resolve(db.from("notification_log").insert({
                  profile_id:        apptData.user_id,
                  appointment_id:    (updated as any)?.appointment_id ?? null,
                  channel:           "email",
                  notification_type: "service_completed",
                  status:            "skipped",
                  provider:          null,
                  created_at:        new Date().toISOString(),
                })).catch(() => {});
              }
            }
          }
        } catch (notifyErr: any) {
          console.error("[completion] Notification prep failed:", notifyErr.message);
        }
      })();
    }

    // Alert owner when a service is completed (info-level — high volume in season)
    if (status === "completed") {
      notifyAdmin({
        event_type:  "field_ops.service_completed",
        severity:    "info",
        title:       `Service completed — assignment ${id}`,
        entity_type: "assignment",
        entity_id:   id,
        metadata:    { employee_id: actor.employeeId, appointment_id: (updated as any)?.appointment_id ?? null },
      });
    }

    // Alert owner when employee marks no-show (warning — operational issue)
    if (status === "no_show") {
      notifyAdmin({
        event_type:  "field_ops.employee_no_show",
        severity:    "warning",
        title:       `Employee no-show — assignment ${id}`,
        body:        `Employee ${actor.employeeId} marked assignment ${id} as no-show. Customer may need to be rescheduled.`,
        entity_type: "assignment",
        entity_id:   id,
        metadata:    { employee_id: actor.employeeId, appointment_id: (updated as any)?.appointment_id ?? null },
      });
    }

    // Alert owner when assignment is skipped (info — may indicate access or scheduling issue)
    if (status === "skipped") {
      notifyAdmin({
        event_type:  "field_ops.assignment_skipped",
        severity:    "info",
        title:       `Assignment skipped — ${id}`,
        body:        `Employee ${actor.employeeId} skipped assignment ${id}. Review notes and consider rescheduling.`,
        entity_type: "assignment",
        entity_id:   id,
        metadata:    { employee_id: actor.employeeId, appointment_id: (updated as any)?.appointment_id ?? null },
      });
    }

    // GPS snapshot — only stored if employee has given consent (gps_consent_at IS NOT NULL)
    if (latitude != null && longitude != null) {
      void (async () => {
        try {
          const { data: empData } = await db
            .from("employees")
            .select("gps_consent_at, is_test")
            .eq("id", actor.employeeId)
            .maybeSingle();

          if (!empData?.gps_consent_at) return; // no consent — skip

          const pingSource = empData.is_test ? "simulated" : "browser";
          await db.from("employee_location_pings").insert({
            employee_id: actor.employeeId,
            assignment_id: id,
            latitude,
            longitude,
            accuracy_meters: accuracy ?? null,
            status_trigger: status,
            source: pingSource,
            is_test: empData.is_test ?? false,
          });

          // Persist geo columns on assignments
          if (status === "in_progress") {
            await db
              .from("assignments")
              .update({ geo_arrive: `SRID=4326;POINT(${longitude} ${latitude})` })
              .eq("id", id);
          }
          if (status === "completed") {
            await db
              .from("assignments")
              .update({ geo_complete: `SRID=4326;POINT(${longitude} ${latitude})` })
              .eq("id", id);
          }
        } catch (gpsErr: any) {
          console.error("[EmployeeAssignments] GPS snapshot failed:", gpsErr.message);
        }
      })();
    }

    // Route stop status synchronization (fire-and-forget)
    void (async () => {
      try {
        const stopStatusMap: Record<string, string> = {
          en_route:    "en_route",
          in_progress: "arrived",
          completed:   "completed",
          skipped:     "skipped",
          no_show:     "skipped",
        };
        const routeStopStatus = stopStatusMap[status];
        if (!routeStopStatus) return;

        const { data: stop } = await db
          .from("route_stops")
          .select("id, route_id")
          .eq("assignment_id", id)
          .maybeSingle();
        if (!stop) return;

        await db.from("route_stops").update({ status: routeStopStatus }).eq("id", stop.id);

        // Advance route to in_progress when first stop starts
        if (status === "en_route" || status === "in_progress") {
          await db.from("routes")
            .update({ status: "in_progress" })
            .eq("id", stop.route_id)
            .in("status", ["published", "assigned"]);
        }

        // Auto-complete route when all stops are terminal
        if (["completed", "skipped", "no_show"].includes(status)) {
          const { data: allStops } = await db
            .from("route_stops")
            .select("status")
            .eq("route_id", stop.route_id);
          const TERMINAL = ["completed", "skipped"];
          const allDone = (allStops || []).length > 0 && (allStops || []).every((s: any) => TERMINAL.includes(s.status));
          if (allDone) {
            await db.from("routes").update({ status: "completed" }).eq("id", stop.route_id);
            void db.from("route_audit_log").insert({
              route_id: stop.route_id,
              actor_id: actor.userId,
              actor_role: "employee",
              action: "route_completed",
              metadata: { auto: true, trigger_assignment_id: id },
            });
          }
        }
      } catch (syncErr: any) {
        console.error("[RouteSync] Failed to sync route stop:", syncErr.message);
      }
    })();

    console.log(`[EmployeeAssignments] Assignment ${id} → ${status} by employee ${actor.employeeId}`);
    return res.json({ ok: true, assignment: updated });
  } catch (err: any) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/employee/assignments/:id/arrive
 * Records arrival at the property and transitions status to in_progress.
 * Optionally captures GPS snapshot (latitude, longitude, accuracy) if employee has consent.
 */
router.post("/assignments/:id/arrive", async (req, res) => {
  const actor = await getAuthenticatedEmployee(req);
  if (!actor) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.params;
  const { latitude, longitude, accuracy } = req.body ?? {};

  try {
    const { data: current, error: fetchErr } = await db
      .from("assignments")
      .select("id, employee_id, status, arrived_at, started_at")
      .eq("id", id)
      .single();

    if (fetchErr || !current) return res.status(404).json({ error: "Assignment not found" });
    if (current.employee_id !== actor.employeeId) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const now = new Date().toISOString();
    const update: Record<string, string> = {};

    if (!current.arrived_at) update.arrived_at = now;
    if (!current.started_at) update.started_at = now;

    // Advance from en_route → in_progress
    if (current.status === "en_route" || current.status === "assigned") {
      update.status = "in_progress";
    }

    const { data: updated, error: updateErr } = await db
      .from("assignments")
      .update(update)
      .eq("id", id)
      .select("id, status, en_route_at, arrived_at, started_at, completed_at")
      .single();

    if (updateErr) return res.status(500).json({ error: "Failed to record arrival" });

    // GPS snapshot on arrive
    if (latitude != null && longitude != null) {
      void (async () => {
        try {
          const { data: empData } = await db
            .from("employees")
            .select("gps_consent_at, is_test")
            .eq("id", actor.employeeId)
            .maybeSingle();
          if (!empData?.gps_consent_at) return;
          await db.from("employee_location_pings").insert({
            employee_id: actor.employeeId,
            assignment_id: id,
            latitude, longitude,
            accuracy_meters: accuracy ?? null,
            status_trigger: "arrived",
            source: empData.is_test ? "simulated" : "browser",
            is_test: empData.is_test ?? false,
          });
          await db
            .from("assignments")
            .update({ geo_arrive: `SRID=4326;POINT(${longitude} ${latitude})` })
            .eq("id", id);
        } catch (gpsErr: any) {
          console.error("[EmployeeAssignments] GPS arrive snapshot failed:", gpsErr.message);
        }
      })();
    }

    return res.json({ ok: true, assignment: updated });
  } catch (err: any) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/employee/assignments/:id/media
 * Persists job media (photo/video/doc) to Supabase job_media table.
 */
router.post("/assignments/:id/media", async (req, res) => {
  const actor = await getAuthenticatedEmployee(req);
  if (!actor) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.params;
  const { url, media_type, caption } = req.body ?? {};

  if (!url || !media_type) {
    return res.status(400).json({ error: "url and media_type are required" });
  }
  if (!["photo", "video", "doc"].includes(media_type)) {
    return res.status(400).json({ error: "media_type must be photo, video, or doc" });
  }

  try {
    // Verify ownership
    const { data: assign } = await db
      .from("assignments")
      .select("employee_id")
      .eq("id", id)
      .single();

    if (!assign || assign.employee_id !== actor.employeeId) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const { data: media, error } = await db
      .from("job_media")
      .insert({ assignment_id: id, media_type, url, caption: caption ?? null })
      .select()
      .single();

    if (error) return res.status(500).json({ error: "Failed to save media" });

    // Alert admin when media is uploaded (info — good for field visibility)
    notifyAdmin({
      event_type:  "field_ops.media_uploaded",
      severity:    "info",
      title:       `Job media uploaded — assignment ${id}`,
      body:        `Employee ${actor.employeeId} uploaded ${media_type} to assignment ${id}.`,
      entity_type: "assignment",
      entity_id:   id,
      metadata:    { employee_id: actor.employeeId, media_type, url: (media as any)?.url ?? null },
    });

    return res.json({ ok: true, media });
  } catch (err: any) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/employee/assignments/:id/checklist
 * Returns the saved pre-service checklist state for an assignment.
 */
router.get("/assignments/:id/checklist", async (req, res) => {
  const actor = await getAuthenticatedEmployee(req);
  if (!actor) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.params;

  const { data: assign } = await db
    .from("assignments")
    .select("employee_id")
    .eq("id", id)
    .maybeSingle();

  if (!assign || assign.employee_id !== actor.employeeId) {
    return res.status(403).json({ error: "Not authorized" });
  }

  const { data: row } = await db
    .from("job_checklists")
    .select("checklist, completed_at")
    .eq("assignment_id", id)
    .maybeSingle();

  return res.json({ items: row?.checklist ?? null, completed_at: row?.completed_at ?? null });
});

/**
 * POST /api/employee/assignments/:id/checklist
 * Persists the pre-service checklist state for an assignment.
 * Body: { items: Array<{ label: string; checked: boolean }> }
 */
router.post("/assignments/:id/checklist", async (req, res) => {
  const actor = await getAuthenticatedEmployee(req);
  if (!actor) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.params;
  const { items } = req.body ?? {};

  if (!Array.isArray(items)) {
    return res.status(400).json({ error: "items must be an array" });
  }

  const { data: assign } = await db
    .from("assignments")
    .select("employee_id")
    .eq("id", id)
    .maybeSingle();

  if (!assign || assign.employee_id !== actor.employeeId) {
    return res.status(403).json({ error: "Not authorized" });
  }

  const allChecked = items.every((item: any) => item.checked === true);
  const now = new Date().toISOString();

  const { data: existing } = await db
    .from("job_checklists")
    .select("id")
    .eq("assignment_id", id)
    .maybeSingle();

  if (existing) {
    await db
      .from("job_checklists")
      .update({
        checklist: items,
        completed_by: actor.employeeId,
        completed_at: allChecked ? now : null,
      })
      .eq("id", existing.id);
  } else {
    await db.from("job_checklists").insert({
      assignment_id: id,
      checklist: items,
      completed_by: actor.employeeId,
      completed_at: allChecked ? now : null,
    });
  }

  return res.json({ ok: true, all_checked: allChecked });
});

export default router;
