import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";

interface Technician {
  id: string;
  name: string;
  clocked_in: boolean;
  is_stale: boolean | null;
  location_label: "current" | "last_known" | "unavailable";
  location: { lat: number; lng: number } | null;
}

interface Stop {
  id: string;
  status: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  is_blocked: boolean;
}

interface Bounds { minLat: number; maxLat: number; minLng: number; maxLng: number }

function calculateBounds(points: Array<{ lat: number; lng: number }>): Bounds {
  if (points.length === 0) return { minLat: 33.5, maxLat: 33.8, minLng: -118.0, maxLng: -117.7 };
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const padding = 0.01;
  return {
    minLat: Math.min(...lats) - padding,
    maxLat: Math.max(...lats) + padding,
    minLng: Math.min(...lngs) - padding,
    maxLng: Math.max(...lngs) + padding,
  };
}

function project(lat: number, lng: number, bounds: Bounds, canvas: HTMLCanvasElement) {
  const latRange = bounds.maxLat - bounds.minLat || 0.01;
  const lngRange = bounds.maxLng - bounds.minLng || 0.01;
  const scale = Math.min(canvas.width / lngRange, canvas.height / latRange);
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const relLat = lat - bounds.minLat;
  const relLng = lng - bounds.minLng;
  const x = centerX - ((lngRange / 2 - relLng) * scale);
  const y = centerY + ((latRange / 2 - relLat) * scale);
  return { x, y };
}

/** Compact dispatch map for the Operations Command Center — distinct from
 * EmployeeMap.tsx (the Live Tracking page's own full sidebar-layout map):
 * this shows technicians AND today's route stops together at a glance,
 * with a legend, and links out to the full detail pages rather than
 * duplicating them. Reuses the same canvas-projection approach, not a
 * second tracking data source — all positions come from
 * getTechnicianStatusList() via /api/admin/operations/dispatch-map. */
export function DispatchMap({ technicians, stops }: { technicians: Technician[]; stops: Stop[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    ctx.fillStyle = "#f3f4f6";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    for (let i = 0; i <= canvas.width; i += 40) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
    }
    for (let i = 0; i <= canvas.height; i += 40) {
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
    }

    const techPoints = technicians.filter((t) => t.location).map((t) => t.location!);
    const stopPoints = stops.filter((s) => s.lat != null && s.lng != null).map((s) => ({ lat: s.lat!, lng: s.lng! }));
    const bounds = calculateBounds([...techPoints, ...stopPoints]);

    // Stops first (smaller, behind), technicians on top (larger, in front).
    stops.forEach((s) => {
      if (s.lat == null || s.lng == null) return;
      const { x, y } = project(s.lat, s.lng, bounds, canvas);
      ctx.fillStyle = s.is_blocked ? "#ef4444" : s.status === "completed" ? "#10b981" : "#94a3b8";
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    technicians.forEach((t) => {
      if (!t.location) return;
      const { x, y } = project(t.location.lat, t.location.lng, bounds, canvas);
      const stale = t.location_label === "last_known" || t.is_stale;
      ctx.fillStyle = !t.clocked_in ? "#94a3b8" : stale ? "#f59e0b" : "#3b82f6";
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#1f2937";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(t.name.split(" ")[0], x, y + 18);
    });
  }, [technicians, stops]);

  const visibleTechCount = technicians.filter((t) => t.location).length;

  return (
    <div className="rounded-2xl border border-border/70 bg-card/95 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Dispatch Map</h3>
        <span className="text-xs text-muted-foreground">{visibleTechCount} technician{visibleTechCount === 1 ? "" : "s"} shown — polled, not real-time</span>
      </div>
      <canvas ref={canvasRef} className="h-80 w-full rounded-lg bg-background border border-border/50" />
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Active</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Stale/last known</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-gray-400" /> Clocked out</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Stop completed</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" /> Stop blocked/no-show</span>
      </div>
      <div className="mt-4 flex gap-3 border-t border-border/40 pt-3">
        <Link to="/admin/employee-tracking" className="text-xs font-semibold text-primary underline-offset-2 hover:underline">
          Open Employee Tracking →
        </Link>
        <Link to="/admin/route-planning" className="text-xs font-semibold text-primary underline-offset-2 hover:underline">
          Open Route Planning →
        </Link>
      </div>
    </div>
  );
}
