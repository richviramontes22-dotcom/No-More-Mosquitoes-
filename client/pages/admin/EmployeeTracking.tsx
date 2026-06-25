import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SectionHeading from "@/components/common/SectionHeading";
import EmployeeMap from "@/components/admin/EmployeeMap";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, RefreshCw, Clock, AlertTriangle } from "lucide-react";
import { adminApi } from "@/lib/adminApi";
import { AdminOwnershipBadge, AdminOwnershipNote } from "@/components/admin/AdminOwnershipBadge";

interface Employee {
  id: string;
  name: string;
  role: string;
  phone?: string;
  status: string;
  clocked_in: boolean;
  has_gps_consent: boolean;
  last_ping_at: string | null;
  is_stale: boolean | null;
  location_label: "current" | "last_known" | "unavailable";
  location: { lat: number; lng: number } | null;
  assignment: {
    id: string;
    customer_name: string;
    address: string;
  } | null;
  lastUpdate: string | null;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const EmployeeTracking = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchEmployees = async () => {
    try {
      const data = await adminApi("/api/admin/tracking/employees");
      setEmployees(data);
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Failed to fetch employees:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

    // 45s — matches the ~60s ping interval closely enough to feel current
    // without polling faster than the data actually changes. Not real-time;
    // labeled as such below.
    const interval = setInterval(fetchEmployees, 45_000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const activeCount = employees.filter(
    (e) => e.status === "en_route" || e.status === "in_progress"
  ).length;

  const idleCount = employees.length - activeCount;

  return (
    <div className="grid gap-8">
      <SectionHeading
        eyebrow="Employee Tracking"
        title="Employee Location Monitoring"
        description="View employee assignment status and location data."
      />

      <AdminOwnershipNote
        title="Workforce visibility tool"
        description="Live Tracking is a monitoring surface. Employee records remain the primary workforce management tool."
      >
        <AdminOwnershipBadge kind="visibility" />
        <Button variant="outline" size="sm" className="rounded-xl" asChild>
          <Link to="/admin/employees">Employee Records</Link>
        </Button>
      </AdminOwnershipNote>

      {/* Real data note — replaces the old "Demo Data" warning now that this
          page reads real employee_location_pings rows instead of a
          hardcoded null. Still explicitly not real-time: it's polled, and
          says so. */}
      <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/30 px-5 py-4">
        <Clock className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-foreground">Polled, not real-time</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Locations refresh every ~45 seconds, matching how often a clocked-in, consented technician's
            device sends a position. A technician must be clocked in and have granted location consent for
            their position to appear here.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-border/70 bg-card/95 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Active Employees</p>
              <p className="mt-2 text-3xl font-display text-foreground">{activeCount}</p>
            </div>
            <div className="rounded-lg bg-green-100/50 p-3">
              <MapPin className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card/95 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Idle Employees</p>
              <p className="mt-2 text-3xl font-display text-foreground">{idleCount}</p>
            </div>
            <div className="rounded-lg bg-gray-100/50 p-3">
              <Clock className="h-6 w-6 text-gray-600" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card/95 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Total Employees</p>
              <p className="mt-2 text-3xl font-display text-foreground">{employees.length}</p>
            </div>
            <div className="rounded-lg bg-blue-100/50 p-3">
              <MapPin className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          {lastRefresh && (
            <p className="text-xs text-muted-foreground">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {autoRefresh ? "Auto-refresh: On" : "Auto-refresh: Off"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchEmployees}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {loading && employees.length === 0 ? (
        <div className="rounded-2xl border border-border/70 bg-card/95 p-12 text-center">
          <p className="text-muted-foreground">Loading employees...</p>
        </div>
      ) : (
        <EmployeeMap employees={employees} />
      )}

      <div className="rounded-2xl border border-border/70 bg-card/95 p-6">
        <h3 className="mb-4 text-sm font-semibold text-foreground">All Employees</h3>
        <div className="space-y-3">
          {employees.map((emp) => (
            <div key={emp.id} className="flex items-center justify-between rounded-lg border border-border/50 p-4">
              <div className="flex-1">
                <p className="font-semibold">{emp.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {emp.phone || "No phone"}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge variant={emp.clocked_in ? "default" : "outline"} className="text-[10px]">
                    {emp.clocked_in ? "Clocked In" : "Clocked Out"}
                  </Badge>
                  {!emp.has_gps_consent && (
                    <span className="text-[10px] text-muted-foreground">No GPS consent</span>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge
                  variant={
                    emp.status === "in_progress"
                      ? "default"
                      : emp.status === "en_route"
                        ? "secondary"
                        : "outline"
                  }
                >
                  {emp.status === "in_progress"
                    ? "Working"
                    : emp.status === "en_route"
                      ? "En Route"
                      : "Idle"}
                </Badge>
                {emp.location_label === "unavailable" && (
                  <p className="text-xs text-muted-foreground">No recent location</p>
                )}
                {emp.location && emp.location_label === "current" && (
                  <p className="text-xs text-green-700 font-medium">
                    {emp.location.lat.toFixed(3)}, {emp.location.lng.toFixed(3)} · {timeAgo(emp.last_ping_at)}
                  </p>
                )}
                {emp.location && emp.location_label === "last_known" && (
                  <p className="text-xs text-amber-700">
                    Last known: {emp.location.lat.toFixed(3)}, {emp.location.lng.toFixed(3)} · {timeAgo(emp.last_ping_at)}
                    {emp.clocked_in && emp.is_stale ? " (stale)" : !emp.clocked_in ? " (off duty)" : ""}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EmployeeTracking;
