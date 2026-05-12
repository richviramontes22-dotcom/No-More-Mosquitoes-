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
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { usePropertyLookup } from "@/hooks/use-property-lookup";
import PropertyQuestionnaire, { PropertyQuestionnaireData } from "@/components/page/PropertyQuestionnaire";
import { Loader2, Search } from "lucide-react";

interface AddPropertyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (property: any) => void;
  property?: any; // Add this prop for editing
}

export const AddPropertyDialog = ({ open, onOpenChange, onSuccess, property }: AddPropertyDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { lookup, isLoading: isLookupLoading, error: lookupError } = usePropertyLookup();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasLookedUp, setHasLookedUp] = useState(false);
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
    gateInstructions: ""
  });

  // Debug logging
  useEffect(() => {
    console.log("[AddPropertyDialog] open state changed:", open, "property:", property?.id);
  }, [open, property?.id]);

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

      // Try to parse questionnaire data from notes
      try {
        if (property.notes) {
          // Look for gateInstructions in the notes field
          const gateMatch = property.notes.match(/Gate:\s*([^|]*)/);
          const gateCode = gateMatch ? gateMatch[1].trim() : "";

          // Parse other questionnaire fields if they exist
          setQuestionnaireData(prev => ({
            ...prev,
            gateInstructions: gateCode || prev.gateInstructions
          }));
        }
      } catch (e) {
        // If parsing fails, use defaults
        console.log("Could not parse questionnaire data from notes");
      }

      setHasLookedUp(true); // Mark as looked up since we're loading existing data
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
        gateInstructions: ""
      });
      setHasLookedUp(false);
    }
  }, [property, open]);

  // Reset lookup state when dialog closes
  useEffect(() => {
    if (!open) {
      setHasLookedUp(false);
    }
  }, [open]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.id]: e.target.value }));
  };

  const handleLookup = async () => {
    if (!formData.address || !formData.zip) {
      toast({
        title: "Missing Details",
        description: "Please enter both street address and ZIP code.",
        variant: "destructive"
      });
      return;
    }

    const result = await lookup(formData.address, formData.zip, formData.city);
    if (result) {
      setFormData(prev => ({
        ...prev,
        acreage: result.acreage.toString()
      }));
      setHasLookedUp(true);
      toast({
        title: "Property Found",
        description: `Acreage: ${result.acreage} acres`,
      });
    } else if (lookupError) {
      toast({
        title: "Lookup Failed",
        description: lookupError || "Unable to find property data. You can enter acreage manually.",
        variant: "destructive"
      });
    }
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!formData.address || !formData.zip) {
      toast({ title: "Validation Error", description: "Please provide an address and ZIP code.", variant: "destructive" });
      return;
    }

    // If no acreage provided, use default of 0.25 acres
    const acreageValue = formData.acreage ? parseFloat(formData.acreage) : 0.25;

    // Build comprehensive notes from questionnaire data
    const notesArray: string[] = [];

    // Add gate instructions if present
    if (questionnaireData.gateInstructions) {
      notesArray.push(`Gate: ${questionnaireData.gateInstructions}`);
    }

    // Add property preferences summary
    const preferencesArray: string[] = [];
    if (questionnaireData.hasPets) {
      preferencesArray.push(`Pets: ${questionnaireData.petDetails || "Yes"}`);
    }
    if (questionnaireData.childrenUseYard) {
      preferencesArray.push("Children use yard");
    }
    if (questionnaireData.hasStandingWater) {
      preferencesArray.push("Standing water sources present");
    }
    preferencesArray.push(`Yard usage: ${questionnaireData.yardUsage}`);
    if (questionnaireData.primaryConcerns) {
      preferencesArray.push(`Concerns: ${questionnaireData.primaryConcerns}`);
    }

    if (preferencesArray.length > 0) {
      notesArray.push(preferencesArray.join(" | "));
    }

    // Add any additional notes
    if (formData.notes) {
      notesArray.push(formData.notes);
    }

    const combinedNotes = notesArray.join(" | ");

    setIsSubmitting(true);
    try {
      let result;
      if (property?.id && !property.isMock) {
        // Update existing property
        const { data, error } = await supabase
          .from("properties")
          .update({
            address: `${formData.address}${formData.city ? `, ${formData.city}` : ""}`,
            zip: formData.zip,
            acreage: acreageValue,
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
            acreage: acreageValue,
            notes: combinedNotes
          })
          .select()
          .single();

        if (error) throw error;
        result = data;

        toast({
          title: "Property Added Successfully",
          description: `Property at ${formData.address} has been added${formData.acreage ? ` with ${formData.acreage} acres` : " (default 0.25 acres)"}.`,
        });
      }

      console.log("[AddPropertyDialog] Calling onSuccess");
      onSuccess(result);
      console.log("[AddPropertyDialog] Calling onOpenChange(false)");
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
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {property ? "Edit Property" : "Add New Property"}
          </DialogTitle>
          <DialogDescription>
            {property
              ? "Update your property details and preferences below."
              : "Provide the address and specific property details."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4 max-h-[70vh] overflow-y-auto">
          {/* Address Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Property Address</h3>
            <div className="space-y-2">
              <Label htmlFor="address">Street Address</Label>
              <Input
                id="address"
                placeholder="e.g., 123 Main St"
                value={formData.address}
                onChange={handleInputChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                placeholder="e.g., Newport Beach"
                value={formData.city}
                onChange={handleInputChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zip">ZIP Code</Label>
              <Input
                id="zip"
                placeholder="e.g., 92660"
                value={formData.zip}
                onChange={handleInputChange}
              />
            </div>
            <div className="space-y-3">
              <Label>Estimate Acreage</Label>
              <Button
                type="button"
                variant="outline"
                onClick={handleLookup}
                disabled={isLookupLoading || !formData.address || !formData.zip}
                className="w-full"
              >
                {isLookupLoading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Looking up...</>
                ) : (
                  <><Search className="mr-2 h-4 w-4" /> Look Up Acreage</>
                )}
              </Button>
              {hasLookedUp && (
                <p className="text-xs text-green-600 font-medium">✓ Acreage automatically populated from GIS data</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="acreage">Acreage</Label>
              <Input
                id="acreage"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.25"
                value={formData.acreage}
                onChange={(e) => setFormData(prev => ({ ...prev, acreage: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">If not available via lookup, you can enter manually</p>
            </div>
          </div>

          {/* Questionnaire Section */}
          <div className="space-y-4 border-t border-border/40 pt-6">
            <h3 className="text-lg font-semibold text-foreground">Property Preferences</h3>
            <PropertyQuestionnaire
              data={questionnaireData}
              onChange={setQuestionnaireData}
              hideSubmit={true}
              disabled={false}
            />
          </div>

          {/* Additional Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes</Label>
            <Textarea
              id="notes"
              placeholder="Any other details technicians should know..."
              value={formData.notes}
              onChange={handleInputChange}
              className="min-h-[100px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !formData.address || !formData.zip}
          >
            {isSubmitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
            ) : (
              property ? "Save Changes" : "Add Property"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
