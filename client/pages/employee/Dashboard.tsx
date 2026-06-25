import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, AlertTriangle, MapPin, ShieldAlert, ShieldOff, ShieldQuestion } from "lucide-react";
import SectionHeading from "@/components/common/SectionHeading";
import { ClockWidget } from "@/components/employee/ClockWidget";
import { useEmployee } from "@/hooks/employee/useEmployee";
import { useEmployeeAssignments } from "@/hooks/employee/useEmployeeAssignments";
import { useLocationTracking } from "@/hooks/employee/useLocationTracking";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { CustomerServicePanel } from "./CustomerServicePanel";
import { SalesPanel } from "./SalesPanel";

const Dashboard = () => {
  const { data: profile, isLoading: profileLoading } = useProfile();

  // customer_service and sales never have an employees table row (no field
  // work, no route/assignment data) — route them to their own dashboard
  // before touching anything that depends on one.
  if (profileLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (profile?.role === "customer_service") return <CustomerServicePanel />;
  if (profile?.role === "sales") return <SalesPanel />;

  return <TechnicianDashboard />;
};

const TechnicianDashboard = () => {
  const { data: employee, isLoading: empLoading } = useEmployee();
  const { data: assignments = [], isLoading: assignLoading } = useEmployeeAssignments(employee?.id);
  const [shiftId, setShiftId] = useState<string | null>(null);
  // Real, server-known clock state — not just "did I click Clock In during
  // this page session," since that resets to false on every reload even
  // with a genuinely open shift. GPS tracking gates on this, so it has to
  // be right immediately on load, not just after a fresh click.
  const [clockedIn, setClockedIn] = useState(false);
  const [clockStateLoading, setClockStateLoading] = useState(true);

  useEffect(() => {
    if (!employee) return;
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { setClockStateLoading(false); return; }
      try {
        const res = await fetch("/api/employee/shifts/current", { headers: { Authorization: `Bearer ${token}` } });
        if (cancelled) return;
        if (res.ok) {
          const { shift } = await res.json();
          if (shift?.id) { setShiftId(shift.id); setClockedIn(true); }
        }
      } finally {
        if (!cancelled) setClockStateLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [employee?.id]);

  const completed = assignments.filter((a) => a.status === "completed").length;
  const next = assignments.find((a) => a.status !== "completed" && a.status !== "no_show" && a.status !== "skipped");

  // GPS tracking — only while genuinely clocked in AND consented. The
  // server independently re-verifies both on every ping regardless; this is
  // just what decides whether the client even tries.
  const trackingEnabled = clockedIn && !!employee?.gps_consent_at;
  const trackingStatus = useLocationTracking(trackingEnabled);

  const handleClockIn = async (geo?: GeolocationPosition) => {
    if (!employee) return;
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) return;

    const res = await fetch("/api/employee/shifts/clock-in", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      const { shift } = await res.json();
      if (shift?.id) { setShiftId(shift.id); setClockedIn(true); }
    }
  };

  const handleClockOut = async (geo?: GeolocationPosition) => {
    if (!employee) return;
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) return;

    await fetch("/api/employee/shifts/clock-out", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(shiftId ? { shift_id: shiftId } : {}),
    });
    setShiftId(null);
    setClockedIn(false);
  };

  if (empLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center space-y-2">
        <p className="font-semibold text-amber-900">No employee record found</p>
        <p className="text-sm text-amber-700">
          Your account hasn't been linked to an employee profile yet. Please contact your administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      {/* TEST ACCOUNT banner */}
      {employee.is_test && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Test Account</p>
            <p className="text-xs text-amber-700">This is a test account. Real customer data may be masked.</p>
          </div>
        </div>
      )}

      {/* Onboarding pending banner */}
      {employee.onboarding_status === "pending" || employee.onboarding_status === "in_progress" ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-orange-200 bg-orange-50 px-5 py-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-orange-800">Onboarding incomplete</p>
              <p className="text-xs text-orange-700">Required forms are waiting for your signature.</p>
            </div>
          </div>
          <Link
            to="/employee/onboarding"
            className="shrink-0 text-xs font-semibold text-orange-700 underline-offset-2 hover:underline"
          >
            Complete Now
          </Link>
        </div>
      ) : null}

      {/* GPS consent reminder */}
      {!employee.gps_consent_at && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-3">
          <div className="flex items-center gap-3">
            <MapPin className="h-5 w-5 text-blue-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-blue-800">GPS Tracking Not Enabled</p>
              <p className="text-xs text-blue-700">Enable location tracking in your profile to share your position with dispatch while you're clocked in.</p>
            </div>
          </div>
          <Link
            to="/employee/profile"
            className="shrink-0 text-xs font-semibold text-blue-700 underline-offset-2 hover:underline"
          >
            Go to Profile
          </Link>
        </div>
      )}

      {/* Location Tracking indicator — reflects the real, current tracking
          state, not just whether consent has ever been granted. Tracking
          only runs while clocked in; clocking out (or revoking consent)
          stops it immediately. */}
      {employee.gps_consent_at && (
        <>
          {trackingStatus === "active" && (
            <div className="flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 px-5 py-3">
              <ShieldAlert className="h-4 w-4 text-green-600 shrink-0" />
              <p className="text-xs text-green-800 font-medium">
                Location Tracking: On — your location is shared with dispatch every minute while you're
                clocked in.
              </p>
            </div>
          )}
          {trackingStatus === "off" && !clockStateLoading && (
            <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/40 px-5 py-3">
              <ShieldOff className="h-4 w-4 text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground font-medium">
                Location Tracking: Off — {clockedIn ? "starting…" : "will turn on automatically when you clock in."}
              </p>
            </div>
          )}
          {trackingStatus === "permission_denied" && (
            <div className="flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-3">
              <ShieldQuestion className="h-4 w-4 text-amber-600 shrink-0" />
              <p className="text-xs text-amber-800 font-medium">
                Location Tracking: Blocked — your browser denied location access. Enable location permission
                for this site in your browser settings to share your route position with dispatch.
              </p>
            </div>
          )}
          {trackingStatus === "unsupported" && (
            <div className="flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-3">
              <ShieldQuestion className="h-4 w-4 text-amber-600 shrink-0" />
              <p className="text-xs text-amber-800 font-medium">
                Location Tracking: Unavailable — this browser doesn't support location sharing.
              </p>
            </div>
          )}
        </>
      )}

      <SectionHeading
        eyebrow="Employee"
        title="Today on your route"
        description="Clock in, review your stops, and message dispatch."
      />

      <ClockWidget onClockIn={handleClockIn} onClockOut={handleClockOut} initialOnDuty={clockedIn} />

      <div className="grid gap-6 sm:grid-cols-3">
        <div className="rounded-2xl border border-border/70 bg-card/95 p-6">
          <p className="text-sm text-muted-foreground">Stops today</p>
          <p className="mt-2 text-3xl font-display">
            {assignLoading ? "—" : assignments.length}
          </p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card/95 p-6">
          <p className="text-sm text-muted-foreground">Completed</p>
          <p className="mt-2 text-3xl font-display">
            {assignLoading ? "—" : completed}
          </p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card/95 p-6">
          <p className="text-sm text-muted-foreground">Next stop</p>
          <p className="mt-2 text-3xl font-display">
            {assignLoading ? "—" : next?.scheduled_at
              ? new Date(next.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "—"}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
