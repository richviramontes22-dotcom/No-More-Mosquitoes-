// Persists ScheduleFlow state to localStorage so users can resume mid-flow.
// Scoped to the authenticated user — never restored for a different userId.
// TTL: 7 days. Cleared automatically on successful booking or on expiry.

const KEY      = "nmm_schedule_progress";
const VERSION  = 1;
const TTL_MS   = 7 * 24 * 60 * 60 * 1000;

export type FlowStep =
  | "plan"
  | "property"
  | "availability"
  | "date-time"
  | "questionnaire"
  | "summary"
  | "payment";

export interface FlowProgressState {
  _v:                  number;
  savedAt:             string;
  userId:              string;
  step:                FlowStep;
  cadenceDays?:        number;
  program?:            "subscription" | "one_time" | "annual";
  selectedPropertyId?: string | null;
  contactPhone?:       string;
  selectedDateISO?:    string | null;
  selectedWindowId?:   string | null;
  selectedWindowLabel?: string | null;
  selectedWindowStart?: string | null;
  selectedWindowEnd?:   string | null;
  preferredDays?:      number[];
  preferredWindows?:   string[];
  flexibilityDays?:    number;
  visitNotes?:         string;
}

export const STEP_LABELS: Record<FlowStep, string> = {
  plan:          "Plan Selection",
  property:      "Property",
  availability:  "Schedule Preferences",
  "date-time":   "Date & Time",
  questionnaire: "Visit Details",
  summary:       "Review",
  payment:       "Payment",
};

// Steps when plan is already known (Path A — came from quote widget)
const PATH_A_STEPS: FlowStep[] = ["property", "availability", "date-time", "questionnaire", "summary", "payment"];
// Steps when plan must be chosen in-flow (Path B — direct signup)
// Property comes first so acreage is known when plan prices are displayed.
const PATH_B_STEPS: FlowStep[] = ["property", "plan", "availability", "date-time", "questionnaire", "summary", "payment"];

export function getStepNumber(step: FlowStep, hasPlanStep: boolean): number {
  const order = hasPlanStep ? PATH_B_STEPS : PATH_A_STEPS;
  const idx = order.indexOf(step);
  return idx === -1 ? 1 : idx + 1;
}

export function getTotalSteps(hasPlanStep: boolean): number {
  return hasPlanStep ? PATH_B_STEPS.length : PATH_A_STEPS.length;
}

export function saveFlowProgress(
  state: Omit<FlowProgressState, "_v" | "savedAt">,
): void {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ ...state, _v: VERSION, savedAt: new Date().toISOString() }),
    );
  } catch {
    // Quota exceeded or private-browsing restriction — silently skip.
  }
}

export function loadFlowProgress(userId: string): FlowProgressState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FlowProgressState>;
    if (parsed._v !== VERSION) { clearFlowProgress(); return null; }
    if (parsed.userId !== userId) return null;
    if (!parsed.savedAt) return null;
    if (Date.now() - new Date(parsed.savedAt).getTime() > TTL_MS) {
      clearFlowProgress();
      return null;
    }
    return parsed as FlowProgressState;
  } catch {
    return null;
  }
}

export function clearFlowProgress(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
