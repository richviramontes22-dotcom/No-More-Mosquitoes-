import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { usePropertyLookup } from "@/hooks/use-property-lookup";
import { Loader2, MapPin, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface AddPropertyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (property: any) => void;
  property?: any;
}

const inputCls =
  "w-full rounded-xl border border-border/70 bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition";
const labelCls = "text-[11px] font-bold uppercase tracking-wider text-muted-foreground";

export const AddPropertyDialog = ({
  open, onOpenChange, onSuccess, property,
}: AddPropertyDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { lookup, isLoading: isLookupLoading } = usePropertyLookup();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acreageDetected, setAcreageDetected] = useState(false);
  const [lookupFailed, setLookupFailed] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const [address, setAddress]   = useState("");
  const [city, setCity]         = useState("");
  const [stateVal, setStateVal] = useState("CA");
  const [zip, setZip]           = useState("");
  const [acreage, setAcreage]   = useState("");
  const [gateCode, setGateCode] = useState("");
  const [hasPets, setHasPets]   = useState(false);
  const [petDetails, setPetDetails] = useState("");
  const [hasChildren, setHasChildren] = useState(false);
  const [standingWater, setStandingWater] = useState(false);
  const [notes, setNotes] = useState("");

  // Pre-fill for edit mode
  useEffect(() => {
    if (!open) return;
    if (property) {
      const parts = (property.address || "").split(",");
      setAddress(parts[0]?.trim() || "");
      setCity(parts[1]?.trim() || "");
      setStateVal(parts[2]?.trim() || "CA");
      setZip(property.zip || "");
      setAcreage(property.acreage?.toString() || "");
      setAcreageDetected(!!property.acreage);
      const gateMatch = (property.notes || "").match(/Gate:\s*([^|]*)/);
      setGateCode(gateMatch?.[1]?.trim() || "");
      setNotes("");
    } else {
      setAddress(""); setCity(""); setStateVal("CA"); setZip("");
      setAcreage(""); setAcreageDetected(false); setLookupFailed(false);
      setGateCode(""); setHasPets(false); setPetDetails("");
      setHasChildren(false); setStandingWater(false); setNotes("");
      setShowDetails(false);
    }
  }, [property, open]);

  const handleLookup = async () => {
    if (!address || !zip) {
      toast({ title: "Missing details", description: "Enter street address and ZIP to auto-detect lot size.", variant: "destructive" });
      return;
    }
    const result = await lookup(address, zip, city, stateVal);
    if (result) {
      setAcreage(result.acreage.toString());
      setAcreageDetected(true);
      setLookupFailed(false);
      toast({ title: "Property found", description: `Lot size: ${result.acreage} acres — pricing updated.` });
    } else {
      setLookupFailed(true);
    }
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!address || !zip) {
      toast({ title: "Required fields missing", description: "Address and ZIP are required.", variant: "destructive" });
      return;
    }
    const acreageVal = acreage ? parseFloat(acreage) : 0.25;
    const noteParts: string[] = [];
    if (gateCode) noteParts.push(`Gate: ${gateCode}`);
    const prefs: string[] = [];
    if (hasPets)       prefs.push(`Pets: ${petDetails || "Yes"}`);
    if (hasChildren)   prefs.push("Children use yard");
    if (standingWater) prefs.push("Standing water sources");
    if (prefs.length)  noteParts.push(prefs.join(" | "));
    if (notes)         noteParts.push(notes);
    const combinedNotes = noteParts.join(" | ");

    const fullAddress = [address, city].filter(Boolean).join(", ");

    setIsSubmitting(true);
    try {
      let result;
      if (property?.id && !property.isMock) {
        const { data, error } = await supabase
          .from("properties")
          .update({ address: fullAddress, zip, acreage: acreageVal, notes: combinedNotes })
          .eq("id", property.id)
          .select().single();
        if (error) throw error;
        result = data;
        toast({ title: "Property updated", description: `Changes to ${address} saved.` });
      } else {
        const { data, error } = await supabase
          .from("properties")
          .insert({ user_id: user.id, address: fullAddress, zip, acreage: acreageVal, notes: combinedNotes })
          .select().single();
        if (error) throw error;
        result = data;
        toast({ title: "Property added", description: `${address} is ready for scheduling.` });
      }
      onSuccess(result);
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Could not save property.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-[32px] p-0 overflow-hidden border-border/60">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="font-display text-2xl font-bold">
            {property ? "Edit Property" : "Add a New Property"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {property
              ? "Update the address and details for this location."
              : "We'll detect your lot size automatically for accurate pricing."}
          </p>
        </DialogHeader>

        <div className="px-6 pb-6 pt-4 space-y-5 max-h-[72vh] overflow-y-auto">

          {/* Address fields */}
          <div className="space-y-4 rounded-2xl border border-border/50 bg-muted/20 p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Service Address</p>

            <div className="space-y-1.5">
              <label className={labelCls}>Street Address</label>
              <input
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="123 Oak Street"
                className={inputCls}
                autoComplete="street-address"
              />
            </div>

            <div className="grid grid-cols-6 gap-3">
              <div className="col-span-3 space-y-1.5">
                <label className={labelCls}>City</label>
                <input
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  placeholder="Anaheim"
                  className={inputCls}
                />
              </div>
              <div className="col-span-1 space-y-1.5">
                <label className={labelCls}>State</label>
                <input
                  value={stateVal}
                  onChange={e => setStateVal(e.target.value.toUpperCase())}
                  placeholder="CA"
                  maxLength={2}
                  className={cn(inputCls, "text-center uppercase")}
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <label className={labelCls}>ZIP</label>
                <input
                  value={zip}
                  onChange={e => setZip(e.target.value.replace(/\D/g, ""))}
                  placeholder="92801"
                  maxLength={5}
                  inputMode="numeric"
                  className={inputCls}
                />
              </div>
            </div>

            {/* Auto-detect + acreage */}
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleLookup}
                disabled={isLookupLoading || !address || !zip}
                className="flex-1 rounded-xl h-10 text-sm font-bold border-primary/30 text-primary hover:bg-primary/5"
              >
                {isLookupLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <><MapPin className="h-4 w-4 mr-1.5" /> Auto-detect lot size</>
                )}
              </Button>
              {acreageDetected && (
                <span className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {acreage} acres
                </span>
              )}
            </div>

            {/* Manual acreage fallback */}
            {!acreageDetected && (
              lookupFailed ? (
                <div className="rounded-2xl border border-amber-300/60 bg-amber-50/80 dark:bg-amber-950/30 dark:border-amber-700/40 px-4 py-3 space-y-2 animate-in fade-in duration-300">
                  <p className="text-xs font-bold text-amber-900 dark:text-amber-200">Address not found in parcel database</p>
                  <p className="text-[11px] text-amber-800/70 dark:text-amber-300/70">Enter your lot size manually — or use 0.25 ac if unknown.</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={acreage}
                      onChange={e => setAcreage(e.target.value)}
                      placeholder="e.g. 0.25"
                      className="flex-1 rounded-xl border border-amber-300/60 bg-white dark:bg-amber-950/50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setAcreage("0.25")}
                      className="rounded-xl border border-amber-300/60 bg-white dark:bg-amber-950/50 px-3 py-2.5 text-xs font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-50 transition whitespace-nowrap"
                    >
                      Use 0.25 ac
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className={labelCls}>Lot size (acres) <span className="normal-case font-normal text-muted-foreground/60">— optional, enter manually if known</span></label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={acreage}
                    onChange={e => setAcreage(e.target.value)}
                    placeholder="0.25"
                    className={cn(inputCls, "w-32")}
                  />
                </div>
              )
            )}
          </div>

          {/* Optional property details */}
          <button
            type="button"
            onClick={() => setShowDetails(v => !v)}
            className="flex w-full items-center justify-between text-xs font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition"
          >
            Property details &amp; access info
            {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showDetails && (
            <div className="space-y-4 rounded-2xl border border-border/50 bg-muted/20 p-5 animate-in fade-in duration-200">
              <div className="space-y-1.5">
                <label className={labelCls}>Gate code / access instructions</label>
                <input
                  value={gateCode}
                  onChange={e => setGateCode(e.target.value)}
                  placeholder="e.g. Code #1234, side gate on left"
                  className={inputCls}
                />
              </div>

              <div className="space-y-3">
                <p className={labelCls}>Property info</p>
                {[
                  { id: "pets", label: "Pets use this yard", checked: hasPets, set: setHasPets },
                  { id: "children", label: "Children use this yard", checked: hasChildren, set: setHasChildren },
                  { id: "water", label: "Standing water sources (pond, fountain, etc.)", checked: standingWater, set: setStandingWater },
                ].map(({ id, label, checked, set }) => (
                  <label key={id} className="flex items-center gap-3 cursor-pointer group">
                    <div
                      onClick={() => set(!checked)}
                      className={cn(
                        "h-5 w-5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0",
                        checked ? "border-primary bg-primary" : "border-border/60 group-hover:border-primary/40",
                      )}
                    >
                      {checked && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                    </div>
                    <span className="text-sm text-foreground">{label}</span>
                  </label>
                ))}
              </div>

              {hasPets && (
                <div className="space-y-1.5">
                  <label className={labelCls}>Pet details</label>
                  <input
                    value={petDetails}
                    onChange={e => setPetDetails(e.target.value)}
                    placeholder="e.g. 2 dogs, kept inside during service"
                    className={inputCls}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className={labelCls}>Additional notes for technicians</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Anything else the technician should know..."
                  rows={3}
                  className={cn(inputCls, "resize-none")}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border/40 px-6 py-4 bg-background">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="rounded-xl font-semibold text-muted-foreground"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !address || !zip}
            className="rounded-xl px-6 h-11 font-bold shadow-brand"
          >
            {isSubmitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</>
            ) : (
              property ? "Save Changes" : "Add Property"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
