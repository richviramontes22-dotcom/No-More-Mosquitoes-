import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import SectionHeading from "@/components/common/SectionHeading";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, MapPin, Navigation, Clock, ChevronRight, RefreshCw, WifiOff } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { navUrl } from "@/lib/employee/deepLinks";
import { Link } from "react-router-dom";
import { useEmployee } from "@/hooks/employee/useEmployee";
import { cacheRoute, getCachedRoute } from "@/lib/employee/offlineCache";

interface RouteStop {
  id: string;
  sequence_number: number;
  status: string;
  arrival_eta: string | null;
  departure_eta: string | null;
  estimated_duration_minutes: number;
  notes: string | null;
  assignment_id: string;
  assignment_status: string;
  service_type: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  address: string | null;
  city: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
}

interface RouteData {
  id: string;
  date: string;
  status: string;
  published_at: string | null;
  total_distance_miles: number | null;
  total_duration_minutes: number | null;
}

const STOP_STATUS_COLORS: Record<string, string> = {
  pending:   "border-border/60 bg-card/90",
  scheduled: "border-border/60 bg-card/90",
  en_route:  "border-blue-300 bg-blue-50",
  arrived:   "border-purple-300 bg-purple-50",
  completed: "border-green-300 bg-green-50",
  skipped:   "border-gray-200 bg-gray-50",
};

const EmployeeRoute = () => {
  const { data: employee } = useEmployee();
  const [route, setRoute] = useState<RouteData | null>(null);
  const [stops, setStops] = useState<RouteStop[]>([]);
  const [hasRoute, setHasRoute] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [lastLoaded, setLastLoaded] = useState<Date | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);
  const today = format(new Date(), "yyyy-MM-dd");

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  };

  const loadRoute = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const res = await fetch("/api/employee/routes/today", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load route");
      const data = await res.json();
      setRoute(data.route);
      setStops(data.stops || []);
      setHasRoute(data.has_route);
      setLastLoaded(new Date());
      setIsFromCache(false);
      // Own data only (employee.id), today's date only — yesterday's cached
      // route never shows up labeled as today's.
      if (employee?.id) cacheRoute(employee.id, today, data);
    } catch (err: any) {
      // Network failure (or the route endpoint genuinely being unavailable)
      // — fall back to the last cached copy of today's route rather than
      // just giving up and showing the "no route" empty state.
      if (employee?.id) {
        const cached = getCachedRoute<{ route: RouteData | null; stops: RouteStop[]; has_route: boolean }>(employee.id, today);
        if (cached && !cached.isExpired) {
          setRoute(cached.data.route);
          setStops(cached.data.stops || []);
          setHasRoute(cached.data.has_route);
          setLastLoaded(new Date(cached.cachedAt));
          setIsFromCache(true);
        } else {
          setHasRoute(false);
        }
      } else {
        setHasRoute(false);
      }
    } finally {
      setIsLoading(false);
    }
  }, [employee?.id, today]);

  useEffect(() => {
    loadRoute();
    // Poll every 2 minutes for route updates
    const interval = setInterval(loadRoute, 120000);
    return () => clearInterval(interval);
  }, [loadRoute]);

  const nextStop = stops.find((s) => ["pending", "scheduled", "en_route", "arrived"].includes(s.status));
  const completedCount = stops.filter((s) => s.status === "completed").length;
  const skippedCount = stops.filter((s) => s.status === "skipped").length;

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="grid gap-6">
      <div className="flex items-start justify-between gap-4">
        <SectionHeading
          eyebrow="Today"
          title="My Route"
          description="Stops in dispatch order. Navigate to each stop and update status."
        />
        <Button variant="outline" size="sm" className="rounded-xl shrink-0" onClick={loadRoute}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
        </Button>
      </div>

      {isFromCache && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-800">
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
          Offline / Cached Data — showing your route as of {lastLoaded?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.
        </div>
      )}

      {!hasRoute ? (
        // No published route — fallback to assignments list link
        <div className="rounded-2xl border border-border/70 bg-card/95 p-8 text-center space-y-3">
          <MapPin className="h-8 w-8 text-muted-foreground/30 mx-auto" />
          <p className="font-semibold">No route published for today</p>
          <p className="text-sm text-muted-foreground">
            Your route hasn't been published yet. View your assignments individually.
          </p>
          <Link to="/employee/assignments">
            <Button variant="outline" className="rounded-xl mt-2">View Assignments</Button>
          </Link>
        </div>
      ) : (
        <>
          {/* Summary bar */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-border/70 bg-card/95 p-4 text-center">
              <p className="text-xs text-muted-foreground">Stops</p>
              <p className="text-2xl font-display font-bold mt-1">{stops.length}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card/95 p-4 text-center">
              <p className="text-xs text-muted-foreground">Done</p>
              <p className="text-2xl font-display font-bold mt-1 text-green-600">{completedCount}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card/95 p-4 text-center">
              <p className="text-xs text-muted-foreground">Miles</p>
              <p className="text-2xl font-display font-bold mt-1">
                {route?.total_distance_miles?.toFixed(1) ?? "—"}
              </p>
            </div>
          </div>

          {/* Route update banner */}
          {route?.published_at && lastLoaded && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
              <Clock className="h-3.5 w-3.5" />
              Route published {new Date(route.published_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              {" · "}Updated {lastLoaded.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
          )}

          {/* Stop list */}
          <div className="space-y-3">
            {stops.map((stop) => {
              const isNext = stop.id === nextStop?.id;
              const isDone = stop.status === "completed";
              const isSkipped = stop.status === "skipped";
              const hasCoords = stop.lat != null && stop.lng != null;

              return (
                <div
                  key={stop.id}
                  className={`rounded-2xl border p-4 transition ${STOP_STATUS_COLORS[stop.status] ?? "border-border/60 bg-card/90"} ${isNext ? "ring-2 ring-primary/30" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    {/* Sequence badge */}
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      isDone ? "bg-green-100 text-green-700" :
                      isSkipped ? "bg-gray-100 text-gray-500" :
                      isNext ? "bg-primary text-primary-foreground" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {isDone ? <CheckCircle2 className="h-4 w-4" /> : stop.sequence_number}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      {isNext && (
                        <span className="text-xs font-bold text-primary uppercase tracking-widest">Next Stop</span>
                      )}
                      <p className={`font-semibold text-sm ${isDone || isSkipped ? "line-through text-muted-foreground" : ""}`}>
                        {stop.customer_name ?? "Customer"}
                      </p>
                      {stop.address && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {[stop.address, stop.city].filter(Boolean).join(", ")}
                        </p>
                      )}
                      {stop.arrival_eta && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3 shrink-0" />
                          ETA {new Date(stop.arrival_eta).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          {" · "}{stop.estimated_duration_minutes ?? 45} min
                        </p>
                      )}
                      {stop.notes && (
                        <p className="text-xs text-amber-700 mt-1">Note: {stop.notes}</p>
                      )}
                    </div>

                    {/* Actions — min-h-11 (44px) keeps these comfortably
                        tappable one-handed, not just visually present. */}
                    <div className="flex flex-col gap-2 shrink-0">
                      {hasCoords && !isDone && !isSkipped && (
                        <a
                          href={navUrl(stop.lat!, stop.lng!)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-primary/10 text-primary px-3.5 text-xs font-semibold active:bg-primary/20 transition"
                        >
                          <Navigation className="h-3.5 w-3.5" />
                          Navigate
                        </a>
                      )}
                      <Link
                        to={`/employee/assignments/${stop.assignment_id}`}
                        className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-border/60 px-3.5 text-xs font-semibold text-muted-foreground active:bg-muted/50 transition"
                      >
                        Detail <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {stops.length > 0 && (completedCount + skippedCount) === stops.length && (
            <div className="flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 p-4">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
              <p className="text-sm font-semibold text-green-800">
                Route complete — {completedCount} done{skippedCount > 0 ? `, ${skippedCount} skipped` : ""}. Great work.
              </p>
            </div>
          )}

          {/* Sticky next-stop action bar — the #1 pain point from
              TECHNICIAN_EXPERIENCE_AUDIT.md: after scrolling down to read a
              stop's notes, there was no way to act without scrolling back
              up. Pinned to the bottom (thumb-reachable, one-handed) with
              just the two things worth a single tap from here — Navigate
              and jumping to the full detail page for status/notes/photos.
              Padding-bottom on the page content (below) keeps this from
              covering the last stop card. Right padding clears
              ChatWidget.tsx's floating launcher (fixed bottom-4/6 right-4/6,
              h-14 w-14, z-40 — confirmed it would otherwise sit on top of
              and obscure this bar's rightmost button). */}
          {nextStop && (
            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-card/98 py-3 pl-4 pr-20 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur sm:pl-6 sm:pr-24">
              <div className="mx-auto flex max-w-6xl items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Next Stop</p>
                  <p className="truncate text-sm font-semibold">{nextStop.customer_name ?? "Customer"}</p>
                </div>
                {nextStop.lat != null && nextStop.lng != null && (
                  <a
                    href={navUrl(nextStop.lat, nextStop.lng)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-12 shrink-0 items-center gap-1.5 rounded-xl bg-primary/10 px-4 text-sm font-semibold text-primary active:bg-primary/20"
                  >
                    <Navigation className="h-4 w-4" /> Navigate
                  </a>
                )}
                <Link
                  to={`/employee/assignments/${nextStop.assignment_id}`}
                  className="flex h-12 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground active:bg-primary/90"
                >
                  Open <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          )}
        </>
      )}

      {/* Reserves space so the sticky bar above never overlaps the last
          stop card. */}
      {nextStop && <div className="h-20" aria-hidden="true" />}
    </div>
  );
};

export default EmployeeRoute;
