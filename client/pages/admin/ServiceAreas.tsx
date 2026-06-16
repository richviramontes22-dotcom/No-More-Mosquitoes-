import { useEffect, useMemo, useRef, useState } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import ServiceAreaMap from "@/components/admin/ServiceAreaMap";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Plus,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  MapPin,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { adminApi } from "@/lib/adminApi";
import { AdminEmptyState, AdminErrorState, AdminLoadingState } from "@/components/admin/AdminState";

interface ServiceArea {
  id: string;
  zip: string;
  city: string | null;
  state: string | null;
  county: string | null;
  capacity: number | null;
  is_active: boolean;
  updated_at: string;
}

interface DemandSummary {
  zip: string;
  total: number;
  out_of_area_quote: number;
  waitlist_signup: number;
  last_event_at: string;
}

const COUNTY_ORDER = ["Los Angeles", "Orange", "Riverside", "San Bernardino", "San Diego"];

const COUNTY_COLOR: Record<string, string> = {
  "Los Angeles":    "bg-blue-500/10 text-blue-700",
  "Orange":         "bg-orange-500/10 text-orange-700",
  "Riverside":      "bg-purple-500/10 text-purple-700",
  "San Bernardino": "bg-rose-500/10 text-rose-700",
  "San Diego":      "bg-cyan-500/10 text-cyan-700",
};

function pctBar(active: number, total: number) {
  const pct = total > 0 ? Math.round((active / total) * 100) : 0;
  const color =
    pct === 100 ? "bg-green-500" :
    pct >= 75 ? "bg-green-400" :
    pct >= 50 ? "bg-yellow-400" :
    pct >= 25 ? "bg-amber-400" :
    "bg-gray-300";
  return (
    <div className="flex items-center gap-2 shrink-0">
      <div className="w-20 h-1.5 rounded-full bg-border/40 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums w-9 text-right">{pct}%</span>
    </div>
  );
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
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [batchSaving, setBatchSaving] = useState<string | null>(null);
  const [expandedCounties, setExpandedCounties] = useState<Set<string>>(new Set());
  const [demand, setDemand] = useState<DemandSummary[]>([]);
  const [demandLoading, setDemandLoading] = useState(false);
  const countyRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => { fetchAreas(); fetchDemand(); }, []);

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

  const fetchDemand = async () => {
    setDemandLoading(true);
    try {
      const res = await adminApi("/api/admin/service-area-demand");
      setDemand(res.demand ?? []);
    } catch {
      // non-critical
    } finally {
      setDemandLoading(false);
    }
  };

  // Group areas by county, preserving COUNTY_ORDER at the top
  const byCounty = useMemo(() => {
    const map: Record<string, ServiceArea[]> = {};
    for (const area of areas) {
      const c = area.county ?? "Other";
      if (!map[c]) map[c] = [];
      map[c].push(area);
    }
    return map;
  }, [areas]);

  const orderedCounties = useMemo(() => {
    const known = COUNTY_ORDER.filter(c => byCounty[c]?.length);
    const other = Object.keys(byCounty).filter(c => !COUNTY_ORDER.includes(c)).sort();
    return [...known, ...other];
  }, [byCounty]);

  const totalActive = useMemo(() => areas.filter(a => a.is_active).length, [areas]);

  const toggleExpanded = (county: string) => {
    setExpandedCounties(prev => {
      const next = new Set(prev);
      if (next.has(county)) next.delete(county);
      else next.add(county);
      return next;
    });
  };

  const focusCounty = (county: string) => {
    setExpandedCounties(prev => new Set([...prev, county]));
    setTimeout(() => {
      countyRefs.current[county]?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const addSavingId = (id: string) => setSavingIds(prev => new Set([...prev, id]));
  const removeSavingId = (id: string) => setSavingIds(prev => { const n = new Set(prev); n.delete(id); return n; });

  const toggleZip = async (area: ServiceArea) => {
    addSavingId(area.id);
    try {
      const res = await adminApi(`/api/admin/service-areas/${area.id}`, "PATCH", {
        is_active: !area.is_active,
      });
      setAreas(prev => prev.map(a => a.id === area.id ? res.area : a));
    } catch (err: any) {
      toast({ title: "Failed to update ZIP", description: err.message, variant: "destructive" });
    } finally {
      removeSavingId(area.id);
    }
  };

  const toggleCounty = async (county: string, active: boolean) => {
    const targets = (byCounty[county] ?? []).filter(a => a.is_active !== active);
    if (targets.length === 0) return;
    setBatchSaving(county);
    try {
      const res = await adminApi("/api/admin/service-areas/batch-update", "POST", {
        ids: targets.map(a => a.id),
        is_active: active,
      });
      const updated = new Map<string, ServiceArea>((res.areas as ServiceArea[]).map((a: ServiceArea) => [a.id, a]));
      setAreas(prev => prev.map(a => updated.has(a.id) ? updated.get(a.id)! : a));
      toast({ title: `${county} County ${active ? "enabled" : "disabled"}` });
    } catch (err: any) {
      toast({ title: "Batch update failed", description: err.message, variant: "destructive" });
    } finally {
      setBatchSaving(null);
    }
  };

  const addZip = async () => {
    const zip = newZip.trim();
    if (!/^\d{5}$/.test(zip)) {
      toast({ title: "Invalid ZIP — must be 5 digits", variant: "destructive" });
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
      toast({ title: `ZIP ${zip} saved` });
      setNewZip(""); setNewCity(""); setNewState("CA");
    } catch (err: any) {
      toast({ title: "Failed to add ZIP", description: err.message, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="grid gap-8">
      <SectionHeading
        eyebrow="Service Areas"
        title="ZIP Code Coverage"
        description="Manage which ZIP codes receive service. Click a county on the map or expand it in the tree to manage individual ZIPs."
      />

      {/* Main panel: tree (left) + map (right) */}
      <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">

        {/* Tree view */}
        <div className="rounded-2xl border border-border/70 bg-card/95 overflow-hidden">
          {/* State header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 bg-muted/20">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">California</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {totalActive} / {areas.length} ZIPs active
              </span>
              {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
          </div>

          {loading ? (
            <div className="p-6"><AdminLoadingState label="Loading service areas..." /></div>
          ) : loadError ? (
            <div className="p-6">
              <AdminErrorState title="Service areas did not load" description={loadError} onRetry={fetchAreas} />
            </div>
          ) : areas.length === 0 ? (
            <div className="p-6">
              <AdminEmptyState
                title="No service areas"
                description="Add your first ZIP code below to start configuring coverage."
              />
            </div>
          ) : (
            <div>
              {orderedCounties.map((county) => {
                const countyAreas = byCounty[county] ?? [];
                const active = countyAreas.filter(a => a.is_active).length;
                const total = countyAreas.length;
                const isExpanded = expandedCounties.has(county);
                const isBatchSaving = batchSaving === county;
                const colorClass = COUNTY_COLOR[county] ?? "bg-muted/30 text-foreground";

                return (
                  <div
                    key={county}
                    ref={el => { countyRefs.current[county] = el; }}
                    className="border-b border-border/30 last:border-0"
                  >
                    {/* County row */}
                    <div className="flex items-center gap-3 px-5 py-3 hover:bg-muted/10 transition-colors">
                      <button
                        className="flex items-center gap-2 flex-1 min-w-0 text-left"
                        onClick={() => toggleExpanded(county)}
                      >
                        {isExpanded
                          ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                          : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        }
                        <span className="font-medium text-sm">{county} County</span>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${colorClass}`}>
                          {active}/{total}
                        </Badge>
                      </button>
                      {pctBar(active, total)}
                      <div className="flex gap-1 shrink-0 ml-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-green-700 hover:text-green-800 hover:bg-green-50"
                          disabled={isBatchSaving || active === total}
                          onClick={() => toggleCounty(county, true)}
                        >
                          {isBatchSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : "All on"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          disabled={isBatchSaving || active === 0}
                          onClick={() => toggleCounty(county, false)}
                        >
                          {isBatchSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : "All off"}
                        </Button>
                      </div>
                    </div>

                    {/* ZIP rows */}
                    {isExpanded && (
                      <div className="bg-muted/5 border-t border-border/20">
                        {countyAreas.map((area) => {
                          const isSaving = savingIds.has(area.id);
                          return (
                            <div
                              key={area.id}
                              className="flex items-center gap-3 px-6 py-2 border-b border-border/10 last:border-0 hover:bg-muted/10"
                            >
                              <span className="ml-5 font-mono text-sm font-semibold text-foreground w-14 shrink-0">
                                {area.zip}
                              </span>
                              <span className="text-sm text-muted-foreground flex-1 min-w-0 truncate">
                                {area.city ?? "—"}
                              </span>
                              {isSaving
                                ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                                : (
                                  <Switch
                                    checked={area.is_active}
                                    onCheckedChange={() => toggleZip(area)}
                                    disabled={isSaving}
                                    className="shrink-0 scale-90"
                                  />
                                )
                              }
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Map panel */}
        <div className="rounded-2xl border border-border/70 bg-card/95 overflow-hidden lg:sticky lg:top-4">
          <div className="px-5 py-3 border-b border-border/40">
            <p className="font-semibold text-sm">Coverage Map</p>
            <p className="text-xs text-muted-foreground mt-0.5">Click a county to expand it</p>
          </div>
          <div className="p-3">
            <ServiceAreaMap areasByCounty={byCounty} onCountyClick={focusCounty} />
          </div>
          {/* County stat summary */}
          <div className="px-4 pb-4 grid grid-cols-2 gap-2">
            {COUNTY_ORDER.filter(c => byCounty[c]).map(county => {
              const list = byCounty[county] ?? [];
              const active = list.filter(a => a.is_active).length;
              const colorClass = COUNTY_COLOR[county] ?? "bg-muted/30 text-foreground";
              return (
                <button
                  key={county}
                  onClick={() => focusCounty(county)}
                  className="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2 text-left hover:bg-muted/10 transition-colors"
                >
                  <span className="text-xs font-medium truncate">{county}</span>
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ml-2 shrink-0 ${colorClass}`}>
                    {active}/{list.length}
                  </Badge>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Add ZIP form */}
      <div className="rounded-2xl border border-border/70 bg-card/95 p-6">
        <p className="text-sm font-semibold mb-3">Add Service Area ZIP</p>
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

      {/* Expansion Demand */}
      <div className="rounded-2xl border border-border/70 bg-card/95 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
          <div>
            <p className="font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Expansion Demand
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              ZIPs outside your service area with the most quote and waitlist activity.
            </p>
          </div>
          {demandLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        {demandLoading ? (
          <div className="p-6"><AdminLoadingState label="Loading demand data..." /></div>
        ) : demand.length === 0 ? (
          <div className="px-6 py-8 text-sm text-muted-foreground italic text-center">
            No out-of-area demand recorded yet. Demand events are logged when prospects quote or join the waitlist for uncovered ZIPs.
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-4 px-6 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border/30 bg-muted/20">
              <span>ZIP</span>
              <span className="text-center">Total</span>
              <span className="text-center">Quotes</span>
              <span className="text-center">Waitlist</span>
            </div>
            {demand.map((d) => (
              <div key={d.zip} className="grid grid-cols-4 items-center px-6 py-3 border-b border-border/20 last:border-0 hover:bg-muted/10">
                <span className="font-mono font-semibold text-sm">{d.zip}</span>
                <span className="text-center font-bold text-foreground">{d.total}</span>
                <span className="text-center text-sm text-muted-foreground">{d.out_of_area_quote}</span>
                <span className="text-center text-sm text-muted-foreground">{d.waitlist_signup}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ServiceAreas;
