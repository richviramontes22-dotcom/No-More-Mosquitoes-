import { useState, useEffect } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, User, Phone, Truck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEmployee } from "@/hooks/employee/useEmployee";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

const Profile = () => {
  const { data: employee, isLoading } = useEmployee();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [phone, setPhone] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [defaultNav, setDefaultNav] = useState<"google" | "apple">("google");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (employee) {
      setPhone(employee.phone ?? "");
      setVehicle(employee.vehicle ?? "");
      setDefaultNav(employee.default_nav ?? "google");
    }
  }, [employee?.id]);

  const handleSave = async () => {
    if (!employee) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("employees")
        .update({ phone: phone.trim() || null, vehicle: vehicle.trim() || null, default_nav: defaultNav })
        .eq("id", employee.id);

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ["employee", user?.id] });
      toast({ title: "Profile updated", description: "Your preferences have been saved." });
    } catch {
      toast({ title: "Save failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
        <p className="font-semibold text-amber-900">No employee record found.</p>
        <p className="text-sm text-amber-700 mt-1">Contact your administrator to be added to the employee roster.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-8">
      <SectionHeading
        eyebrow="Profile"
        title="Device & preferences"
        description="Navigation default, contact info, and vehicle details."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-2xl border-border/60 bg-card/95">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <User className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg">Contact Info</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Email (read-only)</Label>
              <Input value={user?.email ?? ""} disabled className="rounded-xl bg-muted/50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-phone">
                <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Phone</span>
              </Label>
              <Input
                id="emp-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(949) 555-0123"
                className="rounded-xl"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/60 bg-card/95">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Truck className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg">Vehicle & Navigation</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="emp-vehicle">Vehicle (make / model / plate)</Label>
              <Input
                id="emp-vehicle"
                value={vehicle}
                onChange={(e) => setVehicle(e.target.value)}
                placeholder="Ford Transit — 8ABC123"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-nav">Default navigation app</Label>
              <select
                id="emp-nav"
                value={defaultNav}
                onChange={(e) => setDefaultNav(e.target.value as "google" | "apple")}
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
              >
                <option value="google">Google Maps</option>
                <option value="apple">Apple Maps</option>
              </select>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving} className="rounded-xl px-8">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          {isSaving ? "Saving…" : "Save preferences"}
        </Button>
      </div>

      <Card className="rounded-2xl border-border/60 bg-muted/40">
        <CardContent className="p-6 grid gap-2 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">Employee details</p>
          <p>Role: <span className="capitalize font-medium text-foreground">{employee.role}</span></p>
          <p>Status: <span className="capitalize font-medium text-foreground">{employee.status}</span></p>
          <p>Employee ID: <span className="font-mono text-xs text-foreground">{employee.id.slice(0, 8).toUpperCase()}</span></p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;
