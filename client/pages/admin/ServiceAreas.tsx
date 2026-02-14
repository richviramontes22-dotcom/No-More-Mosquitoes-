import { useMemo, useState } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { serviceAreaZipCodes as seedZips } from "@/data/site";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import FixedCalendar from "@/components/admin/FixedCalendar";

const ServiceAreas = () => {
  const [zips, setZips] = useState<string[]>(() => seedZips.slice());
  const [newZip, setNewZip] = useState("");
  const [capacity, setCapacity] = useState<Record<string, number>>({});
  const [blackouts, setBlackouts] = useState<Date[]>([]);

  const addZip = () => {
    const zip = newZip.trim();
    if (!/^\d{5}$/.test(zip) || zips.includes(zip)) return;
    setZips((prev) => [...prev, zip].sort());
    setNewZip("");
  };

  const totalCapacity = useMemo(() => Object.values(capacity).reduce((a, b) => a + (b || 0), 0), [capacity]);

  return (
    <div className="grid gap-8">
      <SectionHeading
        eyebrow="Service Areas"
        title="ZIPs and capacity"
        description="Manage coverage by ZIP, blackout dates, and technician capacity."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border/70 bg-card/95 p-4 min-w-0 overflow-hidden">
          <div className="flex items-center gap-2">
            <Input placeholder="Add ZIP (e.g. 92620)" className="w-48" value={newZip} onChange={(e) => setNewZip(e.target.value)} />
            <Button onClick={addZip} disabled={!/^\d{5}$/.test(newZip)}>
              Add ZIP
            </Button>
          </div>
          <div className="mt-4 grid max-h-[420px] grid-cols-1 gap-2 overflow-y-auto pr-2 sm:grid-cols-2">
            {zips.map((zip) => (
              <div key={zip} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded border px-3 py-2 text-sm">
                <div className="font-medium truncate">{zip}</div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <span className="text-xs text-muted-foreground shrink-0">Capacity</span>
                  <input
                    type="number"
                    min={0}
                    className="h-8 w-20 shrink-0 rounded-md border border-input bg-background px-2 text-sm"
                    value={capacity[zip] ?? 0}
                    onChange={(e) => setCapacity((prev) => ({ ...prev, [zip]: Number(e.target.value || 0) }))}
                  />
                  <Button variant="outline" size="sm" className="shrink-0" onClick={() => setZips((prev) => prev.filter((z) => z !== zip))}>
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-sm text-muted-foreground">Total daily capacity across ZIPs: {totalCapacity}</div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card/95 p-4 min-w-0 overflow-hidden">
          <div className="text-sm font-semibold">Blackout dates</div>
          <div className="mt-2 text-sm text-muted-foreground">No scheduling allowed on selected dates (e.g., holidays, maintenance).</div>
          <div className="mt-4 flex items-start justify-center">
            <FixedCalendar
              mode="multiple"
              selected={blackouts}
              onSelect={(dates) => setBlackouts(Array.isArray(dates) ? dates : dates ? [dates] : [])}
            />
          </div>
          {blackouts.length > 0 && (
            <div className="mt-3 text-sm text-muted-foreground">
              {blackouts.map((d) => d.toISOString().slice(0, 10)).join(", ")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ServiceAreas;
