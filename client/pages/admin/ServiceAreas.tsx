import { useEffect, useState } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { adminApi } from "@/lib/adminApi";
import { AdminEmptyState, AdminErrorState, AdminLoadingState } from "@/components/admin/AdminState";

interface ServiceArea {
  id: string;
  zip: string;
  city: string | null;
  state: string | null;
  capacity: number | null;
  is_active: boolean;
  updated_at: string;
}

const ServiceAreas = () => {
  const { toast } = useToast();
  const [areas, setAreas] = useState<ServiceArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [newZip, setNewZip] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newState, setNewState] = useState("CA");
  const [adding, setAdding] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => { fetchAreas(); }, []);

  const fetchAreas = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await adminApi("/api/admin/service-areas");
      setAreas(res.areas || []);
    } catch (err: any) {
      setLoadError(err.message);
      toast({ title: "Failed to load service areas", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const addZip = async () => {
    const zip = newZip.trim();
    if (!/^\d{5}$/.test(zip)) {
      toast({ title: "Invalid ZIP - must be 5 digits", variant: "destructive" });
      return;
    }
    if (areas.some(a => a.zip === zip && a.is_active)) {
      toast({ title: "ZIP already active", variant: "destructive" });
      return;
    }

    setAdding(true);
    try {
      const res = await adminApi("/api/admin/service-areas", "POST", {
        zip,
        city: newCity.trim() || null,
        state: newState.trim() || null,
        is_active: true,
      });
      setAreas(prev => {
        const idx = prev.findIndex(a => a.zip === zip);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = res.area;
          return next.sort((a, b) => a.zip.localeCompare(b.zip));
        }
        return [...prev, res.area].sort((a, b) => a.zip.localeCompare(b.zip));
      });
      toast({ title: `ZIP ${zip} saved to service areas` });
      setNewZip("");
      setNewCity("");
      setNewState("CA");
    } catch (err: any) {
      toast({ title: "Failed to add ZIP", description: err.message, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const updateArea = async (area: ServiceArea, changes: Partial<ServiceArea>, successTitle?: string) => {
    setSavingId(area.id);
    try {
      const res = await adminApi(`/api/admin/service-areas/${area.id}`, "PATCH", changes);
      setAreas(prev => prev.map(a => a.id === area.id ? res.area : a));
      if (successTitle) toast({ title: successTitle });
    } catch (err: any) {
      toast({ title: "Failed to update service area", description: err.message, variant: "destructive" });
      fetchAreas();
    } finally {
      setSavingId(null);
    }
  };

  const updateCapacity = async (area: ServiceArea, capacity: number | null) => {
    await updateArea(area, { capacity }, `Capacity updated for ${area.zip}`);
  };

  const deactivateZip = async (area: ServiceArea) => {
    setSavingId(area.id);
    try {
      const res = await adminApi(`/api/admin/service-areas/${area.id}`, "DELETE");
      setAreas(prev => prev.map(a => a.id === area.id ? res.area : a));
      toast({ title: `ZIP ${area.zip} deactivated` });
    } catch (err: any) {
      toast({ title: "Failed to deactivate ZIP", description: err.message, variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  const activeAreas = areas.filter(a => a.is_active);
  const inactiveAreas = areas.filter(a => !a.is_active);
  const totalCapacity = activeAreas.reduce((sum, a) => sum + (a.capacity || 0), 0);

  return (
    <div className="grid gap-8">
      <SectionHeading
        eyebrow="Service Areas"
        title="ZIP Code Coverage"
        description="Manage which ZIP codes receive service. Changes persist immediately."
      />

      <div className="rounded-2xl border border-border/70 bg-card/95 p-6">
        <p className="text-sm font-semibold mb-3">Add Service Area</p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">ZIP Code *</label>
            <Input
              placeholder="92620"
              className="w-32"
              maxLength={5}
              value={newZip}
              onChange={(e) => setNewZip(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && addZip()}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">City</label>
            <Input placeholder="Irvine" className="w-40" value={newCity} onChange={(e) => setNewCity(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">State</label>
            <Input placeholder="CA" className="w-20" maxLength={2} value={newState} onChange={(e) => setNewState(e.target.value.toUpperCase())} />
          </div>
          <Button onClick={addZip} disabled={!/^\d{5}$/.test(newZip) || adding} className="rounded-xl shadow-brand">
            {adding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            {adding ? "Adding..." : "Add ZIP"}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card/95 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
          <div>
            <p className="font-semibold">Active Service Areas</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {activeAreas.length} ZIP{activeAreas.length !== 1 ? "s" : ""} - Total daily capacity: {totalCapacity || "not set"}
            </p>
          </div>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        {loading ? (
          <div className="p-6">
            <AdminLoadingState label="Loading service areas..." />
          </div>
        ) : loadError ? (
          <div className="p-6">
            <AdminErrorState title="Service areas did not load" description={loadError} onRetry={fetchAreas} />
          </div>
        ) : activeAreas.length === 0 ? (
          <div className="p-6">
            <AdminEmptyState title="No active service areas" description="Add your first ZIP code above. Public ZIP checks return unsupported until active rows exist." />
          </div>
        ) : (
          <div className="grid gap-0">
            {activeAreas.map((area, idx) => (
              <div
                key={area.id}
                className={`flex items-center gap-4 px-6 py-4 ${idx < activeAreas.length - 1 ? "border-b border-border/30" : ""}`}
              >
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-semibold text-foreground">{area.zip}</span>
                    {area.city && <span className="text-sm text-muted-foreground">{area.city}</span>}
                    {area.state && <span className="text-sm text-muted-foreground">{area.state}</span>}
                    <Badge variant="outline" className="bg-green-500/10 text-green-700 text-[10px]">Active</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <label className="text-xs text-muted-foreground">Capacity</label>
                  <input
                    type="number"
                    min={0}
                    className="h-8 w-16 rounded-lg border border-border/60 bg-background px-2 text-sm text-center"
                    value={area.capacity ?? ""}
                    placeholder="-"
                    disabled={savingId === area.id}
                    onChange={(e) => {
                      const nextValue = e.target.value === "" ? null : Number(e.target.value);
                      setAreas(prev => prev.map(a => a.id === area.id ? { ...a, capacity: nextValue } : a));
                    }}
                    onBlur={(e) => updateCapacity(area, e.target.value === "" ? null : Number(e.target.value))}
                  />
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" disabled={savingId === area.id} onClick={() => deactivateZip(area)}>
                    {savingId === area.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {inactiveAreas.length > 0 && (
        <div className="rounded-2xl border border-border/40 bg-muted/10 overflow-hidden">
          <div className="px-6 py-3 border-b border-border/30">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Inactive / Removed</p>
          </div>
          {inactiveAreas.map((area) => (
            <div key={area.id} className="flex items-center gap-4 px-6 py-3 opacity-70">
              <span className="font-mono text-sm">{area.zip}</span>
              {area.city && <span className="text-xs text-muted-foreground">{area.city}</span>}
              {area.state && <span className="text-xs text-muted-foreground">{area.state}</span>}
              <Badge variant="outline" className="text-[10px]">Inactive</Badge>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-7 text-xs"
                disabled={savingId === area.id}
                onClick={() => updateArea(area, { is_active: true }, `ZIP ${area.zip} reactivated`)}
              >
                {savingId === area.id ? "Saving..." : "Reactivate"}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ServiceAreas;
