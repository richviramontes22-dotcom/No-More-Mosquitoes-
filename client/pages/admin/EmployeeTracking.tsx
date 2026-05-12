import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SectionHeading from "@/components/common/SectionHeading";
import EmployeeMap from "@/components/admin/EmployeeMap";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, RefreshCw, Clock, AlertTriangle } from "lucide-react";
import { withTimeout } from "@/lib/supabase";
import { AdminOwnershipBadge, AdminOwnershipNote } from "@/components/admin/AdminOwnershipBadge";

interface Employee {
  id: string;
  name: string;
  role: string;
  phone?: string;
  status: string;
  location: { lat: number; lng: number } | null;
  assignment: {
    id: string;
    customer_name: string;
    address: string;
  } | null;
  lastUpdate: string | null;
}

const EmployeeTracking = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchEmployees = async () => {
    try {
      const res = await withTimeout(fetch("/api/admin/tracking/employees"), 10000, "Employee tracking");
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
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

    const interval = setInterval(fetchEmployees, 5000);
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

      {/* Demo data warning — remove when real GPS tracking is implemented */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-400/40 bg-amber-500/5 px-5 py-4">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800">Demo Data — Live GPS Tracking Not Yet Enabled</p>
          <p className="text-xs text-amber-700 mt-0.5">
            The locations shown below are simulated demo data, not real employee positions.
            To enable real-time tracking, the employee mobile app must be built and wired to the <code className="bg-amber-100 px-1 rounded">employee_locations</code> table.
            See <strong>NEXT_DEVELOPMENT_ROADMAP.md</strong> for implementation steps.
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
            {autoRefresh ? "Auto-refresh (demo)" : "Manual refresh (demo)"}
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
                {emp.location && (
                  <p className="text-xs text-muted-foreground">
                    {emp.location.lat.toFixed(3)}, {emp.location.lng.toFixed(3)}
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
