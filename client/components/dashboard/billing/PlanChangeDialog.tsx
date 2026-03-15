import { useState, useMemo, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { CheckCircle2, Loader2, MapPin, Search, Calendar, Zap, CreditCard, Clock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { usePropertyLookup } from "@/hooks/use-property-lookup";
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
  onSuccess: (data: { propertyId: string; newPlan: string; program: string; price: number; cadence?: number }) => void;
}

export const PlanChangeDialog = ({
  open,
  onOpenChange,
  property,
  currentPlan,
  onSuccess,
}: PlanChangeDialogProps) => {
  const { toast } = useToast();

  const [selectedProgram, setSelectedProgram] = useState<ProgramType>("subscription");
  const [selectedFrequency, setSelectedFrequency] = useState<number>(30);
  const [isUpdating, setIsUpdating] = useState(false);

  const pricing = useMemo(() => {
    return calculatePricing({
      acreage: property.acreage,
      program: selectedProgram,
      frequencyDays: selectedFrequency as any
    });
  }, [property.acreage, selectedProgram, selectedFrequency]);

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) throw new Error("No active session");

      const response = await fetch("/api/billing/update-subscription-plan", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          propertyId: property.id,
          program: selectedProgram,
          frequency: selectedFrequency,
          acreage: property.acreage,
          address: property.address,
          zip: property.zip,
          newPlan: pricing?.tierLabel || "Custom"
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to update plan");

      onSuccess({
        propertyId: property.id,
        newPlan: pricing?.tierLabel || "Updated Plan",
        program: selectedProgram,
        price: selectedProgram === "annual" ? (pricing?.annualTotal || 0) : (pricing?.perVisit || 0),
        cadence: selectedProgram === "one_time" ? undefined : selectedFrequency
      });
      onOpenChange(false);
    } catch (error: any) {
      console.error("Plan Update Error:", error);
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const programs: { id: ProgramType; label: string; description: string; icon: any }[] = [
    {
      id: "subscription",
      label: "Monthly",
      description: "Pay per visit with flexible scheduling.",
      icon: Clock
    },
    {
      id: "annual",
      label: "Yearly",
      description: "Save with an annual commitment.",
      icon: Calendar
    },
    {
      id: "one_time",
      label: "One-time",
      description: "Single intensive treatment.",
      icon: Zap
    }
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-[32px] p-0 border-none shadow-2xl">
        <DialogHeader className="p-8 pb-4 space-y-3 bg-primary/5">
          <DialogTitle className="text-2xl font-display font-bold">Change Service Plan</DialogTitle>
          <DialogDescription className="text-base">
            Update your property details to get the most accurate pricing for your service plan.
          </DialogDescription>
        </DialogHeader>

        <div className="p-8 pt-4 space-y-8">
          {/* Section 1: Property Info (Read-only) */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground border-b border-border/40 pb-2 flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              1. Property Details
            </h3>

            <div className="bg-primary/5 rounded-2xl p-6 border border-primary/10 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Service Address</p>
                  <p className="text-lg font-bold">{property.address}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">ZIP Code</p>
                  <p className="text-lg font-bold">{property.zip}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-primary/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Acreage</p>
                    <p className="text-base font-bold">{property.acreage.toFixed(2)} Acres</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pricing Tier</p>
                  <p className="font-bold">{pricing?.tierLabel || "Standard"}</p>
                </div>
              </div>
            </div>
          </div>

          <>
            {/* Section 2: Program Selection */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground border-b border-border/40 pb-2 flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                2. Payment Schedule
              </h3>
              <RadioGroup
                value={selectedProgram}
                onValueChange={(val) => setSelectedProgram(val as ProgramType)}
                className="grid gap-3 sm:grid-cols-3"
              >
                {programs.map((program) => (
                  <div key={program.id}>
                    <RadioGroupItem
                      value={program.id}
                      id={program.id}
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor={program.id}
                      className="flex flex-col items-center text-center gap-3 rounded-2xl border-2 border-border/60 bg-card p-4 hover:bg-muted/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 transition-all cursor-pointer h-full"
                    >
                      <div className={`p-2 rounded-xl ${selectedProgram === program.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                        <program.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-bold text-base">{program.label}</p>
                        <p className="text-[10px] leading-tight text-muted-foreground mt-1">
                          {program.description}
                        </p>
                      </div>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Section 3: Cadence (Only for subscription/annual) */}
            {selectedProgram !== "one_time" && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground border-b border-border/40 pb-2 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  3. Service Frequency
                </h3>
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                  {frequencyOptions.map((freq) => (
                    <Button
                      key={freq}
                      variant={selectedFrequency === freq ? "default" : "outline"}
                      onClick={() => setSelectedFrequency(freq)}
                      className={`rounded-xl h-12 ${selectedFrequency === freq ? 'shadow-brand' : 'border-border/60'}`}
                    >
                      {freq} Days
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground px-2">
                  Frequency determines how often we visit. More frequent visits mean better protection.
                </p>
              </div>
            )}

            {/* Pricing Summary */}
            <div className="bg-muted/30 rounded-3xl p-6 border border-border/40 space-y-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-muted-foreground">Estimated Price</p>
                <div className="text-right">
                  <p className="text-3xl font-bold font-display text-primary">
                    {formatCurrency(selectedProgram === "annual" ? pricing?.annualTotal || 0 : pricing?.perVisit || 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedProgram === "one_time" ? "one-time payment" :
                     selectedProgram === "annual" ? "per year" : "per visit"}
                  </p>
                </div>
              </div>

              {selectedProgram === "subscription" && pricing?.perMonth && (
                <div className="pt-4 border-t border-border/40 flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Monthly average</span>
                  <span className="font-bold">{formatCurrency(pricing.perMonth)}/mo</span>
                </div>
              )}
            </div>
          </>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 p-8 pt-0 mt-auto sticky bottom-0 bg-background/80 backdrop-blur-md">
          <Button
            variant="ghost"
            className="flex-1 rounded-xl h-12"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 rounded-xl h-12 shadow-brand"
            disabled={isUpdating || (selectedProgram === "subscription" && !selectedFrequency)}
            onClick={handleUpdate}
          >
            {isUpdating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {selectedProgram === "one_time" ? "Purchase Treatment" : "Update Subscription"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
