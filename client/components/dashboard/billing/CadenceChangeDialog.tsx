import { useState } from "react";
import { frequencyOptions } from "@/data/site";
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
import { Clock, CheckCircle2, Loader2 } from "lucide-react";
import { supabase, withTimeout } from "@/lib/supabase";

interface CadenceChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  currentCadence: number;
  onSuccess: (newCadence: number) => void;
}

export const CadenceChangeDialog = ({
  open,
  onOpenChange,
  propertyId,
  currentCadence,
  onSuccess,
}: CadenceChangeDialogProps) => {
  const [selectedCadence, setSelectedCadence] = useState(currentCadence.toString());
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) throw new Error("No active session");

      const response = await withTimeout(fetch("/api/billing/update-subscription-cadence", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          propertyId,
          newCadence: parseInt(selectedCadence)
        }),
      }), 10000, "Update cadence");

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to update cadence");

      onSuccess(parseInt(selectedCadence));
      onOpenChange(false);
    } catch (error: any) {
      console.error("Cadence Update Error:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const getLabel = (days: number) => {
    if (days === 14) return "Bi-weekly";
    if (days === 21) return "Every 3 weeks";
    if (days === 30) return "Monthly";
    if (days === 42) return "Every 6 weeks";
    return `${days} days`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-[32px]">
        <DialogHeader className="space-y-3">
          <DialogTitle className="text-2xl font-display font-bold">Update Service Frequency</DialogTitle>
          <DialogDescription>
            Change how often our technicians visit your property. More frequent visits are recommended during peak mosquito season.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={selectedCadence}
          onValueChange={setSelectedCadence}
          className="grid gap-4 pt-4"
        >
          {frequencyOptions.map((option) => (
            <div key={option}>
              <RadioGroupItem
                value={option.toString()}
                id={option.toString()}
                className="peer sr-only"
              />
              <Label
                htmlFor={option.toString()}
                className="flex items-center justify-between rounded-2xl border-2 border-border/60 bg-card p-5 hover:bg-muted/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${selectedCadence === option.toString() ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-bold text-lg">{getLabel(option)}</p>
                    <p className="text-sm text-muted-foreground">{option} days between visits</p>
                  </div>
                </div>
                {selectedCadence === option.toString() && (
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                )}
              </Label>
            </div>
          ))}
        </RadioGroup>

        <div className="flex flex-col sm:flex-row gap-3 pt-8">
          <Button
            variant="ghost"
            className="flex-1 rounded-xl h-12"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 rounded-xl h-12 shadow-brand"
            disabled={isUpdating || selectedCadence === currentCadence.toString()}
            onClick={handleUpdate}
          >
            {isUpdating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Update Cadence
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
