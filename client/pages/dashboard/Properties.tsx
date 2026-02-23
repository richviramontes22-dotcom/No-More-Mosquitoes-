import SectionHeading from "@/components/common/SectionHeading";
import { Button } from "@/components/ui/button";
import {
  Home,
  MapPin,
  Maximize,
  Key,
  MoreVertical,
  Plus,
  Info
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

const Properties = () => {
  const { toast } = useToast();

  const properties = [
    {
      id: "prop-1",
      address: "18 Ocean Vista, Newport Beach, CA 92657",
      zip: "92657",
      acreage: "0.25 acres",
      gateCode: "1929#",
      notes: "Backyard slope; dog in yard.",
      isDefault: true,
    }
  ];

  const handleAddProperty = () => {
    toast({
      title: "Add Property",
      description: "Property onboarding flow started. Our team will verify the parcel size via GIS.",
    });
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
        {properties.map((prop) => (
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
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl">
                  <DropdownMenuItem>Edit Details</DropdownMenuItem>
                  <DropdownMenuItem>Update Gate Code</DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive">Remove Property</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent className="pt-8 grid gap-8 md:grid-cols-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  <Maximize className="h-3 w-3" />
                  Acreage
                </div>
                <p className="text-lg font-semibold">{prop.acreage}</p>
                <p className="text-xs text-muted-foreground leading-tight">Verified via GIS data</p>
              </div>

              <div className="space-y-2 border-l border-border/60 pl-8">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  <Key className="h-3 w-3" />
                  Access Details
                </div>
                <p className="text-lg font-semibold">{prop.gateCode}</p>
                <p className="text-xs text-muted-foreground leading-tight">Gate code for technician</p>
              </div>

              <div className="space-y-2 border-l border-border/60 pl-8">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  <Info className="h-3 w-3" />
                  Service Notes
                </div>
                <p className="text-sm font-medium leading-relaxed italic">"{prop.notes}"</p>
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
    </div>
  );
};

export default Properties;
