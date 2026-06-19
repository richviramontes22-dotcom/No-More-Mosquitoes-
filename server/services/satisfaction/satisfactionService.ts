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

async function handleDetractor(survey: SatisfactionSurvey): Promise<void> {
  try {
    const { data: profile } = await db.from("profiles").select("name, email").eq("id", survey.profile_id).maybeSingle();

    notifyAdmin({
      event_type: "satisfaction.detractor_reported",
      severity: "warning",
      title: `Detractor satisfaction rating (${survey.rating}/10)`,
      body: `${profile?.name || "A customer"} rated a completed service ${survey.rating}/10.${survey.comment ? ` Comment: "${survey.comment}"` : ""}`,
      entity_type: "customer_satisfaction_survey",
      entity_id: survey.id,
      metadata: { appointment_id: survey.appointment_id, rating: survey.rating, issue_category: survey.issue_category },
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
      })
      .select("id")
      .single();

    if (!ticketErr && ticket) {
      await db.from("customer_satisfaction_surveys").update({ ticket_id: ticket.id }).eq("id", survey.id);
    }
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

export interface SatisfactionDashboard {
  nps_score: number | null;
  total_responses: number;
  promoter_count: number;
  passive_count: number;
  detractor_count: number;
  detractors_pending: SatisfactionSurvey[];
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

  const detractorsPending = rows.filter((r) => r.satisfaction_type === "detractor" && r.followup_required && !r.resolved_at);

  return {
    nps_score: npsScore,
    total_responses: total,
    promoter_count: promoterCount,
    passive_count: passiveCount,
    detractor_count: detractorCount,
    detractors_pending: detractorsPending,
  };
}
