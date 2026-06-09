import { useEffect, useState } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save, ShieldCheck } from "lucide-react";
import { adminApi } from "@/lib/adminApi";
import { useToast } from "@/hooks/use-toast";

interface Employee { id: string; name: string; email: string; role: string; }
interface CapacityProfile {
  max_stops_per_day: number;
  skill_level: string;
  is_licensed_applicator: boolean;
  allowed_service_types: string[];
  home_base_address: string;
  vehicle_type: string;
  max_service_minutes_per_day: number | null;
}

const SKILL_LEVELS = ["junior", "standard", "senior", "specialist"];

const defaultProfile = (): CapacityProfile => ({
  max_stops_per_day: 8,
  skill_level: "standard",
  is_licensed_applicator: false,
  allowed_service_types: [],
  home_base_address: "",
  vehicle_type: "",
  max_service_minutes_per_day: null,
});

const WorkforceCapacity = () => {
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [profile, setProfile] = useState<CapacityProfile>(defaultProfile());
  const [effectiveToday, setEffectiveToday] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    adminApi("/api/admin/employees").then((data: any) => {
      const active = (data || []).filter((e: any) => e.status === "active" && ["technician", "dispatcher"].includes(e.role));
      setEmployees(active.map((e: any) => ({ id: e.id, name: e.name, email: e.email, role: e.role })));
    });
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setIsLoading(true);
    adminApi(`/api/admin/workforce/capacity/${selectedId}`).then((data: any) => {
      if (data.profile) {
        setProfile({
          max_stops_per_day: data.profile.max_stops_per_day ?? 8,
          skill_level: data.profile.skill_level ?? "standard",
          is_licensed_applicator: data.profile.is_licensed_applicator ?? false,
          allowed_service_types: data.profile.allowed_service_types ?? [],
          home_base_address: data.profile.home_base_address ?? "",
          vehicle_type: data.profile.vehicle_type ?? "",
          max_service_minutes_per_day: data.profile.max_service_minutes_per_day ?? null,
        });
      } else {
        setProfile(defaultProfile());
      }
      setEffectiveToday(data.effective_today);
    }).catch(console.error).finally(() => setIsLoading(false));
  }, [selectedId]);

  const handleSave = async () => {
    if (!selectedId) return;
    setIsSaving(true);
    try {
      await adminApi(`/api/admin/workforce/capacity/${selectedId}`, "POST", profile);
      toast({ title: "Capacity profile saved" });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const set = (field: keyof CapacityProfile, value: any) => setProfile(p => ({ ...p, [field]: value }));

  return (
    <div className="grid gap-8 pb-20">
      <SectionHeading
        eyebrow="Workforce"
        title="Capacity Settings"
        description="Configure maximum stops, skill levels, and service qualifications per technician."
      />

      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        {/* Technician list */}
        <Card className="rounded-2xl border-border/60 bg-card/95 self-start">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Active Technicians</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 space-y-1">
            {employees.map(emp => (
              <button key={emp.id} onClick={() => setSelectedId(emp.id)}
                className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                  selectedId === emp.id ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted/40"
                }`}>
                <p className="font-medium truncate">{emp.name || emp.email}</p>
                <p className="text-xs text-muted-foreground capitalize">{emp.role}</p>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Capacity editor */}
        <div className="space-y-6">
          {!selectedId ? (
            <div className="rounded-2xl border border-dashed border-border/60 p-12 text-center text-sm text-muted-foreground">
              Select a technician to configure their capacity profile.
            </div>
          ) : isLoading ? (
            <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />Loading capacity…
            </div>
          ) : (
            <>
              {/* Effective today info */}
              {effectiveToday && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  Effective today: max <strong>{effectiveToday.max_stops}</strong> stops/day
                  <span className="text-blue-600 text-xs ml-1">(source: {effectiveToday.source})</span>
                </div>
              )}

              <Card className="rounded-2xl border-border/60 bg-card/95">
                <CardHeader>
                  <CardTitle className="text-base">Daily Limits</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Max stops per day</Label>
                    <Input type="number" min={1} max={30} value={profile.max_stops_per_day}
                      onChange={e => set("max_stops_per_day", Number(e.target.value))} className="rounded-xl" />
                    <p className="text-xs text-muted-foreground">Default: 8</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Max service minutes per day</Label>
                    <Input type="number" min={60} step={30} value={profile.max_service_minutes_per_day ?? ""}
                      placeholder="No limit" onChange={e => set("max_service_minutes_per_day", e.target.value ? Number(e.target.value) : null)}
                      className="rounded-xl" />
                    <p className="text-xs text-muted-foreground">Optional — total on-site time cap</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-border/60 bg-card/95">
                <CardHeader>
                  <CardTitle className="text-base">Qualifications</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Skill level</Label>
                    <select value={profile.skill_level} onChange={e => set("skill_level", e.target.value)}
                      className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm">
                      {SKILL_LEVELS.map(l => <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2 flex flex-col justify-end">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" className="h-4 w-4 rounded" checked={profile.is_licensed_applicator}
                        onChange={e => set("is_licensed_applicator", e.target.checked)} />
                      <span>Licensed Pesticide Applicator (CA DPR)</span>
                    </label>
                    <p className="text-xs text-muted-foreground">Required for restricted pesticide applications</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-border/60 bg-card/95">
                <CardHeader>
                  <CardTitle className="text-base">Vehicle & Home Base</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Vehicle type</Label>
                    <Input value={profile.vehicle_type} onChange={e => set("vehicle_type", e.target.value)}
                      placeholder="e.g., Ford Transit" className="rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label>Home base / Depot address</Label>
                    <Input value={profile.home_base_address} onChange={e => set("home_base_address", e.target.value)}
                      placeholder="123 Warehouse St, Irvine, CA" className="rounded-xl" />
                    <p className="text-xs text-muted-foreground">Used as route starting point (future sprint)</p>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={isSaving} className="rounded-xl px-8 shadow-brand">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Capacity Profile
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkforceCapacity;
