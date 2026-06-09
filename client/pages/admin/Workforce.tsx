import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SectionHeading from "@/components/common/SectionHeading";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, CalendarDays, Gauge, AlertTriangle, CheckCircle2, ChevronRight, Clock } from "lucide-react";
import { adminApi } from "@/lib/adminApi";

interface WorkforceOverview {
  active_technicians: number;
  missing_schedules: number;
  missing_capacity_profiles: number;
  upcoming_blackouts: Array<{ date: string; reason: string }>;
  setup_complete: boolean;
}

const Workforce = () => {
  const [overview, setOverview] = useState<WorkforceOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    adminApi("/api/admin/workforce/overview")
      .then(setOverview)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const cards = [
    {
      label: "Technician Schedules",
      description: "Set weekly availability and working hours per technician.",
      to: "/admin/workforce/schedules",
      icon: CalendarDays,
      iconBg: "bg-blue-100 text-blue-600",
      badge: overview?.missing_schedules ? `${overview.missing_schedules} missing` : null,
      badgeColor: "bg-amber-100 text-amber-700 border-amber-300",
    },
    {
      label: "Capacity Settings",
      description: "Max stops, skill level, service qualifications, and home base.",
      to: "/admin/workforce/capacity",
      icon: Gauge,
      iconBg: "bg-purple-100 text-purple-600",
      badge: overview?.missing_capacity_profiles ? `${overview.missing_capacity_profiles} missing` : null,
      badgeColor: "bg-amber-100 text-amber-700 border-amber-300",
    },
    {
      label: "Time Off",
      description: "PTO requests, sick days, and approval workflow.",
      to: "/admin/workforce/time-off",
      icon: Clock,
      iconBg: "bg-green-100 text-green-600",
      badge: "Coming Sprint B",
      badgeColor: "bg-gray-100 text-gray-500 border-gray-200",
    },
    {
      label: "Availability Calendar",
      description: "Visual calendar showing technician availability at a glance.",
      to: "/admin/workforce/calendar",
      icon: CalendarDays,
      iconBg: "bg-indigo-100 text-indigo-600",
      badge: "Coming Sprint D",
      badgeColor: "bg-gray-100 text-gray-500 border-gray-200",
    },
  ];

  return (
    <div className="grid gap-8 pb-20">
      <SectionHeading
        eyebrow="Workforce"
        title="Workforce Management"
        description="Configure technician schedules, capacity, and availability to ensure safe dispatch."
      />

      {/* Status bar */}
      {overview && (
        <div className={`flex items-center gap-3 rounded-2xl border px-5 py-4 ${
          overview.setup_complete
            ? "border-green-200 bg-green-50"
            : "border-amber-200 bg-amber-50"
        }`}>
          {overview.setup_complete ? (
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          )}
          <div className="flex-1">
            <p className={`text-sm font-semibold ${overview.setup_complete ? "text-green-800" : "text-amber-800"}`}>
              {overview.setup_complete
                ? `Workforce ready — ${overview.active_technicians} active technician${overview.active_technicians !== 1 ? "s" : ""} configured`
                : `Workforce setup incomplete — ${overview.missing_schedules + overview.missing_capacity_profiles} technician profile(s) need attention`}
            </p>
            {!overview.setup_complete && (
              <p className="text-xs text-amber-700 mt-0.5">
                Route planner will use defaults for unconfigured technicians.
              </p>
            )}
          </div>
          <div className="flex gap-4 text-sm font-semibold text-muted-foreground shrink-0">
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />{overview.active_technicians} active
            </span>
          </div>
        </div>
      )}

      {/* Upcoming blackouts */}
      {overview?.upcoming_blackouts && overview.upcoming_blackouts.length > 0 && (
        <Card className="rounded-2xl border-amber-200 bg-amber-50/50">
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Upcoming Company Blackout Dates
            </p>
            <div className="space-y-1">
              {overview.upcoming_blackouts.map((b) => (
                <div key={b.date} className="text-xs text-amber-900 flex items-center gap-2">
                  <span className="font-mono font-semibold">{b.date}</span>
                  <span>— {b.reason}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <Link key={card.to} to={card.to} className="group">
            <Card className="rounded-2xl border-border/60 bg-card/95 hover:border-primary/40 transition-all hover:shadow-md h-full">
              <CardContent className="p-6 flex items-start gap-4">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${card.iconBg}`}>
                  <card.icon className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-foreground">{card.label}</p>
                    {card.badge && (
                      <Badge className={`text-[10px] border rounded px-1.5 py-0 ${card.badgeColor}`}>
                        {card.badge}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{card.description}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Workforce;
