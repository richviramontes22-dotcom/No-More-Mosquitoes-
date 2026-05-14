import { useState, useMemo } from "react";
import { pricingTiers, frequencyOptions } from "@/data/site";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2, MapPin, Calendar, Zap, CreditCard, Clock, Lock, TrendingUp } from "lucide-react";
import { supabase, withTimeout } from "@/lib/supabase";
import { calculatePricing, formatCurrency, ProgramType } from "@/lib/pricing";
import { useToast } from "@/hooks/use-toast";

interface PlanChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property: {
    id: string;
    address: string;
    acreage: number;
    zip: string;
  };
  currentPlan: string;
  currentProgram?: ProgramType;
  currentCadence?: number;
  onSuccess: (data: { propertyId: string; newPlan: string; program: string; price: number; cadence?: number }) => void;
}

export const PlanChangeDialog = ({
  open,
  onOpenChange,
  property,
  currentPlan,
  currentProgram = "subscription",
  currentCadence = 30,
  onSuccess,
}: PlanChangeDialogProps) => {
  const { toast } = useToast();

  const [selectedProgram, setSelectedProgram] = useState<ProgramType>(currentProgram);
  const [selectedFrequency, setSelectedFrequency] = useState<number>(currentCadence);
  const [isUpdating, setIsUpdating] = useState(false);

  const pricing = useMemo(() => {
    return calculatePricing({
      acreage: property.acreage,
      program: selectedProgram,
      frequencyDays: selectedFrequency as any,
    });
  }, [property.acreage, selectedProgram, selectedFrequency]);

  // ── Cadence business logic ────────────────────────────────────────────────
  // Annual plan customers cannot reduce their visit frequency (increase days).
  // They can increase frequency (decrease days) or stay the same.
  const isCadenceLocked = (freq: number): boolean => {
    if (selectedProgram === "annual" && currentProgram === "annual") {
      return freq > currentCadence;
    }
    return false;
  };

  const cadenceLockReason =
    selectedProgram === "annual" && currentProgram === "annual"
      ? "Annual plan customers cannot reduce visit frequency. You can increase frequency or switch to a subscription plan."
      : null;

  // ── Program change side-effects ───────────────────────────────────────────
  const handleProgramChange = (val: ProgramType) => {
    setSelectedProgram(val);
    // When switching TO annual from subscription, lock cadence to current or lower
    if (val === "annual" && selectedFrequency > currentCadence) {
      setSelectedFrequency(currentCadence);
    }
  };

  // ── Visit frequency display helpers ───────────────────────────────────────
  const visitsPerMonth = selectedProgram !== "one_time"
    ? Math.round((30 / selectedFrequency) * 10) / 10
    : null;

  const handleUpdate = async () => {
    if (selectedProgram === "one_time") {
      toast({
        title: "Use the Marketplace for one-time treatments",
        description: "One-time treatments are purchased through the Marketplace, not subscription settings. Select a subscription or annual plan to continue here.",
      });
      return;
    }

    setIsUpdating(true);
    try {
      if (!property?.id) throw new Error("Property information is missing. Please refresh the page.");
      if (!property.acreage) throw new Error("Property acreage is required.");

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Your session has expired. Please log in again.");

      const response = await withTimeout(
        fetch("/api/billing/update-subscription-plan", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            propertyId: property.id,
            program: selectedProgram,
            frequency: selectedFrequency,
            acreage: property.acreage,
            address: property.address,
            zip: property.zip,
            newPlan: pricing?.tierLabel || "Custom",
          }),
        }),
        10000,
        "Update plan"
      );

      let data: any = {};
      try { data = await response.json(); } catch { /* non-JSON body (Netlify 502 page) */ }

      if (!response.ok) {
        const errorMsg = data?.error
          || (response.status === 502 || response.status === 503
            ? "The server took too long to respond. Please try again in a moment."
            : "An error occurred");
        if (errorMsg.includes("No active subscription"))
          throw new Error("No subscription found. Please create a new subscription first.");
        if (errorMsg.includes("Invalid plan configuration"))
          throw new Error("Invalid plan for this property size. Please adjust your selection.");
        throw new Error(errorMsg);
      }

      onSuccess({
        propertyId: property.id,
        newPlan: pricing?.tierLabel || "Updated Plan",
        program: selectedProgram,
        price:
          selectedProgram === "annual"
            ? pricing?.annualTotal || 0
            : pricing?.perVisit || 0,
        cadence: selectedFrequency,
      });
      onOpenChange(false);

      toast({
        title: "Plan updated",
        description: data.message || "Your service plan has been updated successfully.",
      });
    } catch (error: any) {
      let userMessage = error.message || "An error occurred while updating your plan.";
      if (error.message?.includes("session"))
        userMessage = "Your session has expired. Please log in again.";
      else if (error.message?.includes("timeout"))
        userMessage = "Request timed out. Please check your connection and try again.";

      toast({ title: "Update Failed", description: userMessage, variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const programs: { id: ProgramType; label: string; description: string; icon: any }[] = [
    {
      id: "subscription",
      label: "Pay-per-visit",
      description: "Billed per visit. Cancel anytime.",
      icon: Clock,
    },
    {
      id: "annual",
      label: "Annual",
      description: "One annual payment. Priority scheduling.",
      icon: Calendar,
    },
    {
      id: "one_time",
      label: "One-time",
      description: "Single intensive treatment.",
      icon: Zap,
    },
  ];

  const isNoChange =
    selectedProgram === currentProgram && selectedFrequency === currentCadence;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-[32px] p-0 border-none shadow-2xl">
        <DialogHeader className="p-8 pb-4 space-y-3 bg-primary/5">
          <DialogTitle className="text-2xl font-display font-bold">Change Service Plan</DialogTitle>
          <DialogDescription className="text-base">
            Update your billing program or service frequency for this property.
          </DialogDescription>
        </DialogHeader>

        <div className="p-8 pt-4 space-y-8">
          {/* Property Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground border-b border-border/40 pb-2 flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Property Details
            </h3>
            <div className="bg-primary/5 rounded-2xl p-5 border border-primary/10 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Address</p>
                  <p className="text-base font-bold">{property.address}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Zip</p>
                  <p className="text-base font-bold">{property.zip}</p>
                </div>
              </div>
              <div className="pt-3 border-t border-primary/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">{property.acreage.toFixed(2)} acres</span>
                  <span className="text-xs text-muted-foreground">• {pricing?.tierLabel || "—"} tier</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Current: <span className="font-semibold text-foreground capitalize">{currentProgram.replace("_", "-")}</span> · {currentCadence}-day
                </div>
              </div>
            </div>
          </div>

          {/* Program Selection */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground border-b border-border/40 pb-2 flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Billing Program
            </h3>
            <RadioGroup
              value={selectedProgram}
              onValueChange={(v) => handleProgramChange(v as ProgramType)}
              className="grid gap-3 sm:grid-cols-3"
            >
              {programs.map((program) => (
                <div key={program.id}>
                  <RadioGroupItem value={program.id} id={program.id} className="peer sr-only" />
                  <Label
                    htmlFor={program.id}
                    className="flex flex-col items-center text-center gap-3 rounded-2xl border-2 border-border/60 bg-card p-4 hover:bg-muted/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 transition-all cursor-pointer h-full"
                  >
                    <div className={`p-2 rounded-xl ${selectedProgram === program.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      <program.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-bold text-base">{program.label}</p>
                      {program.id === currentProgram && (
                        <span className="text-[9px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">Current</span>
                      )}
                      <p className="text-[10px] leading-tight text-muted-foreground mt-1">{program.description}</p>
                    </div>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Cadence Selection */}
          {selectedProgram !== "one_time" && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground border-b border-border/40 pb-2 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Visit Frequency
                {cadenceLockReason && (
                  <span className="ml-auto text-[10px] normal-case font-normal text-amber-600 flex items-center gap-1">
                    <Lock className="h-3 w-3" /> Partial lock
                  </span>
                )}
              </h3>
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                {frequencyOptions.map((freq) => {
                  const locked = isCadenceLocked(freq);
                  const isCurrent = freq === currentCadence;
                  return (
                    <button
                      key={freq}
                      type="button"
                      disabled={locked}
                      onClick={() => !locked && setSelectedFrequency(freq)}
                      className={[
                        "relative rounded-xl h-14 border-2 text-sm font-semibold transition-all flex flex-col items-center justify-center gap-0.5",
                        locked
                          ? "border-border/30 text-muted-foreground/40 bg-muted/20 cursor-not-allowed"
                          : selectedFrequency === freq
                          ? "border-primary bg-primary text-primary-foreground shadow-brand"
                          : "border-border/60 hover:border-primary/50 hover:bg-muted/40 cursor-pointer",
                      ].join(" ")}
                    >
                      {locked && <Lock className="absolute top-1.5 right-1.5 h-3 w-3 text-muted-foreground/40" />}
                      <span>{freq} days</span>
                      {isCurrent && (
                        <span className={`text-[9px] font-bold uppercase tracking-wider ${selectedFrequency === freq ? "text-primary-foreground/70" : "text-primary"}`}>
                          current
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {cadenceLockReason && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 flex items-start gap-2">
                  <TrendingUp className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  {cadenceLockReason}
                </p>
              )}
              {visitsPerMonth && (
                <p className="text-xs text-muted-foreground px-1">
                  Every {selectedFrequency} days = approximately <strong>{visitsPerMonth} visit{visitsPerMonth !== 1 ? "s" : ""} per month</strong>.
                </p>
              )}
            </div>
          )}

          {/* Pricing Summary */}
          {!pricing?.isCustom ? (
            <div className="bg-muted/30 rounded-3xl p-6 border border-border/40 space-y-3">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-sm font-semibold text-muted-foreground mb-1">Estimated Price</p>
                  {selectedProgram === "subscription" && (
                    <p className="text-xs text-muted-foreground">Billed each visit — not a monthly charge</p>
                  )}
                  {selectedProgram === "annual" && (
                    <p className="text-xs text-muted-foreground">Billed once per year</p>
                  )}
                  {selectedProgram === "one_time" && (
                    <p className="text-xs text-muted-foreground">Single payment</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold font-display text-primary">
                    {formatCurrency(
                      selectedProgram === "annual"
                        ? pricing?.annualTotal || 0
                        : pricing?.perVisit || 0
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedProgram === "one_time"
                      ? "one-time"
                      : selectedProgram === "annual"
                      ? "/ year"
                      : "/ visit"}
                  </p>
                </div>
              </div>

              {selectedProgram === "subscription" && pricing?.perMonth && (
                <div className="pt-3 border-t border-border/40 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Monthly average</p>
                    <p className="font-bold">{formatCurrency(pricing.perMonth)}/mo</p>
                    <p className="text-[10px] text-muted-foreground">({visitsPerMonth} visits × {formatCurrency(pricing.perVisit)})</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Annual cost</p>
                    <p className="font-bold">{formatCurrency(pricing.annualTotal)}/yr</p>
                    <p className="text-[10px] text-muted-foreground">vs {formatCurrency(pricingTiers.find(t => property.acreage >= t.min && property.acreage <= t.max)?.annual as number)}/yr annual plan</p>
                  </div>
                </div>
              )}

              {selectedProgram === "annual" && pricing?.perMonth && (
                <div className="pt-3 border-t border-border/40 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Monthly equivalent</p>
                    <p className="font-bold">{formatCurrency(pricing.perMonth)}/mo</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Per visit (~{pricing.visitsPerYear} visits)</p>
                    <p className="font-bold">{formatCurrency(pricing.perVisit)}/visit</p>
                  </div>
                </div>
              )}

              {pricing?.message && (
                <p className="text-xs text-muted-foreground pt-1 border-t border-border/40">{pricing.message}</p>
              )}
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
              <p className="text-sm font-semibold text-amber-900">Custom pricing required</p>
              <p className="text-xs text-amber-700 mt-1">{pricing?.message}</p>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 p-8 pt-0 sticky bottom-0 bg-background/80 backdrop-blur-md">
          <Button variant="ghost" className="flex-1 rounded-xl h-12" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="flex-1 rounded-xl h-12 shadow-brand"
            disabled={isUpdating || pricing?.isCustom || isNoChange}
            onClick={handleUpdate}
          >
            {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isNoChange
              ? "No changes"
              : selectedProgram === "one_time"
              ? "Purchase Treatment"
              : "Update Subscription"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
