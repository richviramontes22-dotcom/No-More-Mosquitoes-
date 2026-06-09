import { CheckCircle2, Circle, ArrowRight, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useProperties } from "@/hooks/dashboard/useProperties";
import { useSubscriptions } from "@/hooks/dashboard/useSubscriptions";
import { loadFlowProgress, STEP_LABELS } from "@/lib/flowProgress";

const OnboardingProgressWidget = () => {
  const { user } = useAuth();
  const { data: properties = [] } = useProperties(user?.id);
  const { data: subscriptions = [] } = useSubscriptions(user?.id);

  const hasProperty = properties.length > 0;
  const hasPaid = subscriptions.some((s) => s.status === "active");

  // Check for in-progress scheduling flow saved to localStorage
  const savedProgress = user?.id ? loadFlowProgress(user.id) : null;
  const savedStepLabel = savedProgress ? STEP_LABELS[savedProgress.step] : null;

  const steps = [
    { label: "Account created", done: true },
    { label: "Property added", done: hasProperty },
    { label: "Service activated", done: hasPaid },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const totalSteps = steps.length;
  const pct = Math.round((completedCount / totalSteps) * 100);

  const nextLabel = !hasProperty
    ? "Add your property"
    : !hasPaid
    ? "Activate service"
    : "View dashboard";

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
          Setup Progress
        </p>
        <span className="text-[10px] font-bold text-primary">
          {completedCount} / {totalSteps}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full rounded-full bg-primary/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Steps */}
      <ul className="space-y-1.5">
        {steps.map((step) => (
          <li key={step.label} className="flex items-center gap-2 text-xs">
            {step.done ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0" />
            ) : (
              <Circle className="h-3.5 w-3.5 text-muted-foreground/40 flex-shrink-0" />
            )}
            <span
              className={
                step.done ? "text-foreground font-medium" : "text-muted-foreground"
              }
            >
              {step.label}
            </span>
          </li>
        ))}
      </ul>

      {/* Resume banner — shown when a flow session was interrupted */}
      {savedStepLabel && !hasPaid && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2">
          <RotateCcw className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
          <p className="text-[10px] font-bold text-amber-700 leading-tight">
            In progress: <span className="font-black">{savedStepLabel}</span>
          </p>
        </div>
      )}

      <Button
        size="sm"
        className="w-full rounded-xl h-9 text-xs font-bold shadow-brand"
        asChild
      >
        <Link to="/onboarding">
          {savedStepLabel && !hasPaid ? (
            <>Resume from {savedStepLabel} <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></>
          ) : (
            <>{nextLabel} <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></>
          )}
        </Link>
      </Button>
    </div>
  );
};

export default OnboardingProgressWidget;
