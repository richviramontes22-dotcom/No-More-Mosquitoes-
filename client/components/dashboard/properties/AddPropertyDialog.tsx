import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PropertyQuestionnaire, PropertyQuestionnaireData } from "@/components/page/PropertyQuestionnaire";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, CheckCircle2, MapPin } from "lucide-react";
import { usePropertyLookup } from "@/hooks/use-property-lookup";

interface AddPropertyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (property: any) => void;
  property?: any; // Add this prop for editing
}

export const AddPropertyDialog = ({ open, onOpenChange, onSuccess, property }: AddPropertyDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { lookup, isLoading: isSearching, data: parcelData } = usePropertyLookup();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    address: "",
    city: "",
    zip: "",
    acreage: "",
    notes: ""
  });

  const [questionnaireData, setQuestionnaireData] = useState<PropertyQuestionnaireData>({
    hasPets: false,
    petDetails: "",
    childrenUseYard: false,
    primaryConcerns: "",
    hasStandingWater: false,
    yardUsage: "weekly",
    gateInstructions: "",
  });

  // Handle property editing initialization
  useEffect(() => {
    if (property && open) {
      // Split address if it contains a comma
      const parts = property.address.split(",");
      const address = parts[0]?.trim() || "";
      const city = parts[1]?.trim() || "";

      setFormData({
        address,
        city,
        zip: property.zip || "",
        acreage: property.acreage?.toString() || "",
        notes: property.notes || ""
      });

      // Parse notes if they follow the combined format
      if (property.notes) {
        const notesParts = property.notes.split("|").map((p: string) => p.trim());
        const qData: Partial<PropertyQuestionnaireData> = {};
        let notesText = "";

        notesParts.forEach((part: string) => {
          if (part.startsWith("Pets:")) {
            qData.hasPets = part.includes("true");
          } else if (part.startsWith("Children:")) {
            qData.childrenUseYard = part.includes("true");
          } else if (part.startsWith("Water:")) {
            qData.hasStandingWater = part.includes("true");
          } else if (part.startsWith("Gate:")) {
            qData.gateInstructions = part.split(":")[1]?.trim() || "";
          } else {
            // This is the custom notes part
            notesText = part;
          }
        });

        setQuestionnaireData(prev => ({
          ...prev,
          ...qData
        }));

        setFormData(prev => ({
          ...prev,
          notes: notesText
        }));
      }
    } else if (!property && open) {
      // Reset form for new property
      setFormData({ address: "", city: "", zip: "", acreage: "", notes: "" });
      setQuestionnaireData({
        hasPets: false,
        petDetails: "",
        childrenUseYard: false,
        primaryConcerns: "",
        hasStandingWater: false,
        yardUsage: "weekly",
        gateInstructions: "",
      });
    }
  }, [property, open]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.id]: e.target.value }));
  };

  const handleLookup = async () => {
    const result = await lookup(formData.address, formData.zip, formData.city);
    if (result) {
      setFormData(prev => ({
        ...prev,
        acreage: result.acreage.toString()
      }));
      toast({
        title: "Property Found",
        description: `Located parcel with ${result.acreage.toFixed(2)} acres.`,
      });
    }
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!formData.address || !formData.zip) {
      toast({ title: "Validation Error", description: "Please provide an address and ZIP code.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const combinedNotes = `Pets: ${questionnaireData.hasPets} | Children: ${questionnaireData.childrenUseYard} | Water: ${questionnaireData.hasStandingWater} | Gate: ${questionnaireData.gateInstructions} | ${formData.notes}`;

      let result;
      if (property?.id && !property.isMock) {
        // Update existing property
        const { data, error } = await supabase
          .from("properties")
          .update({
            address: `${formData.address}${formData.city ? `, ${formData.city}` : ""}`,
            zip: formData.zip,
            acreage: parseFloat(formData.acreage) || 0,
            notes: combinedNotes
          })
          .eq("id", property.id)
          .select()
          .single();

        if (error) throw error;
        result = data;

        toast({
          title: "Property Updated",
          description: `Changes to ${formData.address} have been saved.`,
        });
      } else {
        // Insert new property
        const { data, error } = await supabase
          .from("properties")
          .insert({
            user_id: user.id,
            address: `${formData.address}${formData.city ? `, ${formData.city}` : ""}`,
            zip: formData.zip,
            acreage: parseFloat(formData.acreage) || 0,
            notes: combinedNotes
          })
          .select()
          .single();

        if (error) throw error;
        result = data;

        toast({
          title: "Property Added Successfully",
          description: `Property at ${formData.address} has been added with ${formData.acreage} acres.`,
        });
      }

      onSuccess(result);
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving property:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save property. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 rounded-[32px] overflow-hidden border-none shadow-2xl flex flex-col">
        <div className="bg-primary/5 p-8 border-b border-border/40 shrink-0">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-2xl font-display font-bold text-primary">
              {property ? "Edit Property" : "Add New Property"}
            </DialogTitle>
            <DialogDescription className="text-base">
              {property
                ? "Update your property details and preferences below."
                : "Provide the address and specific property details to help our technicians deliver precise treatments."}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-8 space-y-10 overflow-y-auto flex-1 custom-scrollbar">
          {/* Address Form Section */}
          <div className="space-y-6">
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground border-b border-border/40 pb-2 flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              1. Location Details
            </h3>
            <div className="grid gap-6 sm:grid-cols-[1fr_1fr_120px_auto]">
              <div className="space-y-2">
                <Label htmlFor="address">Street Address</Label>
                <Input id="address" placeholder="e.g., 123 Main St" className="rounded-xl h-11" value={formData.address} onChange={handleInputChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" placeholder="e.g., Newport Beach" className="rounded-xl h-11" value={formData.city} onChange={handleInputChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zip">ZIP Code</Label>
                <Input id="zip" placeholder="e.g., 92660" className="rounded-xl h-11" value={formData.zip} onChange={handleInputChange} />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  onClick={handleLookup}
                  disabled={isSearching}
                  className="h-11 rounded-xl px-4 bg-primary/10 text-primary hover:bg-primary/20 border-none shadow-none"
                >
                  {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                  {formData.acreage ? "Update" : "Lookup"}
                </Button>
              </div>
            </div>

            {formData.acreage && (
              <div className="bg-primary/5 rounded-2xl p-4 flex items-center justify-between border border-primary/10">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-primary uppercase tracking-wider">Acreage Found (via Regrid)</p>
                    <p className="text-lg font-bold">{parseFloat(formData.acreage).toFixed(2)} Acres</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Manual override</p>
                  <input
                    type="number"
                    step="0.01"
                    className="w-20 bg-transparent border-b border-primary/30 text-right font-bold focus:outline-none focus:border-primary"
                    value={formData.acreage}
                    onChange={(e) => setFormData(prev => ({ ...prev, acreage: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Questionnaire Section */}
          <div className="space-y-6">
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground border-b border-border/40 pb-2">2. Property Preferences</h3>
            <div className="rounded-[28px] overflow-hidden border border-border/50 shadow-sm">
              <PropertyQuestionnaire data={questionnaireData} onChange={setQuestionnaireData} hideSubmit={true} />
            </div>
          </div>

          {/* Additional Notes Section */}
          <div className="space-y-6 pb-4">
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground border-b border-border/40 pb-2">3. Additional Comments</h3>
            <div className="space-y-2">
              <Label htmlFor="notes">Property Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any additional details our technicians should know (e.g., gate codes, aggressive pets, or specific areas of concern)."
                className="rounded-2xl min-h-[120px] bg-background border-border/60 focus:border-primary/40 focus:ring-primary/5 transition-all"
                value={formData.notes}
                onChange={handleInputChange}
              />
              <p className="text-[10px] text-muted-foreground font-medium italic">These notes will be visible to your technician before they arrive.</p>
            </div>
          </div>
        </div>

        <DialogFooter className="p-8 bg-muted/30 border-t border-border/40 flex justify-end gap-3 sm:flex-row flex-col shrink-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl px-6" disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} className="rounded-xl px-8 shadow-brand min-w-[200px]" disabled={isSubmitting || !formData.acreage}>
            {isSubmitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {property ? "Saving..." : "Adding..."}</>
            ) : (
              property ? "Save Changes" : "Add Property & Save Details"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
