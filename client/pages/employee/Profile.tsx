import { useState, useEffect } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, User, Phone, Truck, MapPin, Shield, AlertTriangle } from "lucide-react";
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
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [emergencyRelation, setEmergencyRelation] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isTogglingGps, setIsTogglingGps] = useState(false);

  useEffect(() => {
    if (employee) {
      setPhone(employee.phone ?? "");
      setVehicle(employee.vehicle ?? "");
      setDefaultNav(employee.default_nav ?? "google");
      setEmergencyName(employee.emergency_contact_name ?? "");
      setEmergencyPhone(employee.emergency_contact_phone ?? "");
      setEmergencyRelation(employee.emergency_contact_relation ?? "");
    }
  }, [employee?.id]);

  const handleSave = async () => {
    if (!employee) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("employees")
        .update({
          phone: phone.trim() || null,
          vehicle: vehicle.trim() || null,
          default_nav: defaultNav,
          emergency_contact_name: emergencyName.trim() || null,
          emergency_contact_phone: emergencyPhone.trim() || null,
          emergency_contact_relation: emergencyRelation.trim() || null,
        })
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

  const handleGpsToggle = async () => {
    if (!employee) return;
    setIsTogglingGps(true);
    try {
      if (employee.gps_consent_at) {
        // Withdrawing consent — use the onboarding withdrawal endpoint (audit logged)
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) throw new Error("Session expired");
        const res = await fetch("/api/employee/onboarding/consent/withdraw", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({}),
        });
        if (!res.ok) throw new Error("Failed to withdraw consent");
      } else {
        // Enabling consent via simple profile update
        if (!navigator.geolocation) {
          toast({ title: "GPS not supported", description: "Your browser does not support geolocation.", variant: "destructive" });
          return;
        }
        const { error } = await supabase
          .from("employees")
          .update({ gps_consent_at: new Date().toISOString() })
          .eq("id", employee.id);
        if (error) throw error;
      }

      await queryClient.invalidateQueries({ queryKey: ["employee", user?.id] });
      toast({
        title: employee.gps_consent_at ? "GPS tracking disabled" : "GPS tracking enabled",
        description: employee.gps_consent_at
          ? "Location tracking has been turned off. Withdrawal recorded."
          : "Location will be captured during active assignments only.",
      });
    } catch {
      toast({ title: "Failed to update GPS setting", variant: "destructive" });
    } finally {
      setIsTogglingGps(false);
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

  const gpsEnabled = !!employee.gps_consent_at;

  return (
    <div className="grid gap-8">
      <SectionHeading
        eyebrow="Profile"
        title="Device & preferences"
        description="Navigation default, contact info, GPS, and vehicle details."
      />

      {employee.is_test && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          <p className="text-sm font-semibold text-amber-800">Test Account — settings apply to test workflows only.</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Contact Info */}
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

        {/* Vehicle & Navigation */}
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

        {/* Emergency Contact */}
        <Card className="rounded-2xl border-border/60 bg-card/95">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                <Phone className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg">Emergency Contact</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ec-name">Full Name</Label>
              <Input
                id="ec-name"
                value={emergencyName}
                onChange={(e) => setEmergencyName(e.target.value)}
                placeholder="Jane Doe"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ec-phone">Phone</Label>
              <Input
                id="ec-phone"
                type="tel"
                value={emergencyPhone}
                onChange={(e) => setEmergencyPhone(e.target.value)}
                placeholder="(949) 555-0100"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ec-relation">Relationship</Label>
              <Input
                id="ec-relation"
                value={emergencyRelation}
                onChange={(e) => setEmergencyRelation(e.target.value)}
                placeholder="Spouse, Parent, Partner…"
                className="rounded-xl"
              />
            </div>
          </CardContent>
        </Card>

        {/* GPS Tracking */}
        <Card className="rounded-2xl border-border/60 bg-card/95">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${gpsEnabled ? "bg-green-100 text-green-600" : "bg-muted text-muted-foreground"}`}>
                <MapPin className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg">GPS Location Tracking</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={`rounded-xl border p-4 text-sm space-y-2 ${gpsEnabled ? "border-green-200 bg-green-50" : "border-border/60 bg-muted/30"}`}>
              <div className="flex items-center gap-2 font-semibold">
                <Shield className="h-4 w-4" />
                {gpsEnabled ? "Tracking active" : "Tracking disabled"}
              </div>
              {gpsEnabled ? (
                <>
                  <p className="text-muted-foreground text-xs">
                    Your location is captured when you update assignment status (en route, arrived, completed).
                  </p>
                  <p className="text-muted-foreground text-xs">Enabled: {new Date(employee.gps_consent_at!).toLocaleDateString()}</p>
                </>
              ) : (
                <p className="text-muted-foreground text-xs">
                  Enable to allow the system to capture your location during active assignments only.
                  No off-duty tracking.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <strong>Disclosure (review required by attorney before production use):</strong> Location data is
              captured only during active work assignments. Data is retained for 90 days and visible to management
              only. You may withdraw consent at any time from this page.
            </div>

            <Button
              onClick={handleGpsToggle}
              disabled={isTogglingGps}
              variant={gpsEnabled ? "outline" : "default"}
              className="w-full rounded-xl"
            >
              {isTogglingGps ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <MapPin className="h-4 w-4 mr-2" />
              )}
              {gpsEnabled ? "Disable GPS Tracking" : "Enable GPS Tracking"}
            </Button>
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
          <p>Type: <span className="capitalize font-medium text-foreground">{employee.worker_type}</span></p>
          <p>Status: <span className="capitalize font-medium text-foreground">{employee.status}</span></p>
          <p>Employee ID: <span className="font-mono text-xs text-foreground">{employee.id.slice(0, 8).toUpperCase()}</span></p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;
