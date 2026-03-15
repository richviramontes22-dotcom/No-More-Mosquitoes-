import { useState, useEffect } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { Button } from "@/components/ui/button";
import {
  Home,
  MapPin,
  Maximize,
  Key,
  MoreVertical,
  Plus,
  Info,
  X,
  Loader2
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { AddPropertyDialog } from "@/components/dashboard/properties/AddPropertyDialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { stringifyError } from "@/lib/error-utils";

const SYSTEM_MOCK_PROPERTIES = [
  {
    id: "prop-system-1",
    address: "18 Ocean Vista, Newport Beach, CA 92657",
    zip: "92657",
    acreage: 0.25,
    gateCode: "1929#",
    notes: "Backyard slope; dog in yard.",
    isDefault: true,
    isMock: true
  }
];

const Properties = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<any>(null);
  const [properties, setProperties] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchProperties = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .eq("user_id", user.id);

      if (error) throw error;

      // If no properties in DB, use system mock properties
      const allProperties = data && data.length > 0 ? data.map(p => {
        // Extract gate code and display notes from combined notes field
        let gateCode = "";
        let displayNotes = p.notes || "";

        if (p.notes) {
          const gateMatch = p.notes.match(/Gate:\s*([^|]*)/);
          if (gateMatch) gateCode = gateMatch[1].trim();

          // The last part after the last | is usually the custom notes
          const parts = p.notes.split("|");
          const lastPart = parts[parts.length - 1]?.trim();
          if (lastPart && !lastPart.includes(":")) {
            displayNotes = lastPart;
          } else {
            // Fallback if no custom notes
            displayNotes = "No specific notes provided.";
          }
        }

        return { ...p, gateCode, displayNotes };
      }) : SYSTEM_MOCK_PROPERTIES.map(p => ({ ...p, displayNotes: p.notes }));

      setProperties(allProperties);
    } catch (err: any) {
      console.error("Error fetching properties:", err);
      toast({
        title: "System: Properties Fetch Error",
        description: stringifyError(err),
        variant: "destructive"
      });
      setProperties(SYSTEM_MOCK_PROPERTIES);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, [user]);

  const handleAddProperty = () => {
    setEditingProperty(null);
    setIsAddDialogOpen(true);
  };

  const handleOnSuccess = () => {
    fetchProperties();
    setEditingProperty(null);
  };

  const handleEdit = (prop: any) => {
    setEditingProperty(prop);
    setIsAddDialogOpen(true);
  };

  const handleUpdateGateCode = async (prop: any) => {
    if (prop.isMock) {
      toast({
        title: "Demo Property",
        description: "Gate codes for system demo properties cannot be modified.",
      });
      return;
    }

    const newCode = prompt("Enter new gate code:", prop.gateCode || "");
    if (newCode === null) return;

    try {
      // Update the gate code within the combined notes field
      let newNotes = prop.notes || "";
      if (newNotes.includes("Gate:")) {
        newNotes = newNotes.replace(/Gate:\s*([^|]*)/, `Gate: ${newCode}`);
      } else {
        // If not found, prepend it
        newNotes = `Gate: ${newCode} | ${newNotes}`;
      }

      const { error } = await supabase
        .from("properties")
        .update({ notes: newNotes })
        .eq("id", prop.id);

      if (error) throw error;

      toast({
        title: "Gate Code Updated",
        description: `Access code for ${prop.address.split(",")[0]} has been updated.`,
      });
      fetchProperties();
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRemove = async (prop: any) => {
    if (prop.isMock) {
      toast({
        title: "Demo Property",
        description: "System demo properties cannot be removed.",
      });
      return;
    }

    if (!confirm(`Are you sure you want to remove ${prop.address}? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("properties")
        .delete()
        .eq("id", prop.id);

      if (error) throw error;

      toast({
        title: "Property Removed",
        description: "The service location has been successfully deleted.",
      });
      fetchProperties();
    } catch (error: any) {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="grid gap-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <SectionHeading
          eyebrow="Properties"
          title="Manage your Service Locations"
          description="Keep addresses, ZIPs, acreage, and access notes up to date for precise treatments."
        />
        <Button className="rounded-xl shadow-brand" onClick={handleAddProperty}>
          <Plus className="mr-2 h-4 w-4" />
          Add Property
        </Button>
      </div>

      <div className="grid gap-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-20 bg-muted/10 rounded-[32px] border border-dashed border-border/60">
            <Loader2 className="h-10 w-10 animate-spin text-primary/40 mb-4" />
            <p className="text-muted-foreground font-medium">Loading your properties...</p>
          </div>
        ) : properties.map((prop) => (
          <Card key={prop.id} className="rounded-[28px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
            <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border/40 bg-muted/20">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Home className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-xl font-bold font-display">{prop.address.split(",")[0]}</CardTitle>
                    {prop.isDefault && (
                      <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px]">
                        Primary
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-sm font-medium">{prop.address}</CardDescription>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full h-10 w-10 hover:bg-muted"
                  >
                    <MoreVertical className="h-5 w-5" />
                    <span className="sr-only">Open menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl w-48 shadow-lg z-50">
                  <DropdownMenuItem onClick={() => handleEdit(prop)} className="cursor-pointer">
                    Edit Details
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleUpdateGateCode(prop)} className="cursor-pointer">
                    Update Gate Code
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive cursor-pointer"
                    onClick={() => handleRemove(prop)}
                  >
                    Remove Property
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent className="pt-8 grid gap-8 md:grid-cols-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  <Maximize className="h-3 w-3" />
                  Acreage
                </div>
                <p className="text-lg font-semibold">{prop.acreage} acres</p>
                <p className="text-xs text-muted-foreground leading-tight">Verified via GIS data</p>
              </div>

              <div className="space-y-2 border-l border-border/60 pl-8">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  <Key className="h-3 w-3" />
                  Access Details
                </div>
                <p className="text-lg font-semibold">{prop.gateCode || "Not provided"}</p>
                <p className="text-xs text-muted-foreground leading-tight">Gate code for technician</p>
              </div>

              <div className="space-y-2 border-l border-border/60 pl-8">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  <Info className="h-3 w-3" />
                  Service Notes
                </div>
                <p className="text-sm font-medium leading-relaxed italic">"{prop.displayNotes}"</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-8 text-center">
        <p className="text-sm text-muted-foreground italic">
          Need to add a commercial location or HOA common area? <Button variant="link" className="p-0 h-auto text-primary" onClick={handleAddProperty}>Click here</Button>
        </p>
      </div>

      {/* Add/Edit Property Dialog */}
      <AddPropertyDialog
        open={isAddDialogOpen}
        onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) setEditingProperty(null);
        }}
        onSuccess={handleOnSuccess}
        property={editingProperty}
      />
    </div>
  );
};

export default Properties;
