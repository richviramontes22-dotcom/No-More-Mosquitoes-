import { useEffect, useMemo, useState } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { supabase } from "@/lib/supabase";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Visit {
  id: string;
  date: string;
  customer_name: string;
  customer_email: string;
  property_address: string;
  property_city: string;
  technician_name?: string;
  technician_email?: string;
  notes?: string;
  status: string;
  video_url?: string;
}

const Visits = () => {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [techFilter, setTechFilter] = useState<string>("all");
  const [technicians, setTechnicians] = useState<string[]>([]);

  // Load visits from Supabase
  useEffect(() => {
    const loadVisits = async () => {
      try {
        setIsLoading(true);

        // FIX 1.2: Fetch flat appointment data with pagination
        const { data: appointments, error } = await supabase
          .from("appointments")
          .select("id, scheduled_at, status, notes, user_id, property_id")
          .eq("status", "completed")
          .order("scheduled_at", { ascending: false })
          .limit(100); // Add pagination (20 items per page)

        if (error) {
          console.error("[Visits] Error loading appointments:", error);
          setVisits([]);
          return;
        }

        if (!appointments || appointments.length === 0) {
          setVisits([]);
          return;
        }

        // Fetch related data in parallel (not nested)
        const appointmentIds = appointments.map((a: any) => a.id);
        const userIds = appointments.map((a: any) => a.user_id);
        const propertyIds = appointments.map((a: any) => a.property_id);

        const [
          { data: profiles },
          { data: properties },
          { data: assignments },
        ] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, name, email")
            .in("id", userIds),
          supabase
            .from("properties")
            .select("id, address, city")
            .in("id", propertyIds),
          supabase
            .from("assignments")
            .select("id, appointment_id, employee_id")
            .in("appointment_id", appointmentIds),
        ]);

        // Build lookup maps
        const profileMap = new Map(profiles?.map((p: any) => [p.id, p]) || []);
        const propertyMap = new Map(properties?.map((p: any) => [p.id, p]) || []);
        const assignmentsByAppt = new Map<string, any[]>();
        assignments?.forEach((a: any) => {
          if (!assignmentsByAppt.has(a.appointment_id)) {
            assignmentsByAppt.set(a.appointment_id, []);
          }
          assignmentsByAppt.get(a.appointment_id)!.push(a);
        });

        // Fetch technician profiles and all job media (not limited to 1)
        const assignmentIds = assignments?.map((a: any) => a.id) || [];
        const technicianIds = assignments?.map((a: any) => a.employee_id) || [];

        const [
          { data: techProfiles },
          { data: media },
        ] = await Promise.all([
          technicianIds.length > 0
            ? supabase
                .from("profiles")
                .select("id, name, email")
                .in("id", technicianIds)
            : Promise.resolve({ data: [] }),
          assignmentIds.length > 0
            ? supabase
                .from("job_media")
                .select("url, assignment_id")
                .eq("media_type", "video")
                .in("assignment_id", assignmentIds)
            : Promise.resolve({ data: [] }),
        ]);

        const techProfileMap = new Map<string, any>(techProfiles?.map((p: any) => [p.id, p] as [string, any]) || []);
        const mediaByAssignment = new Map<string, string>();
        media?.forEach((m: any) => {
          if (!mediaByAssignment.has(m.assignment_id)) {
            mediaByAssignment.set(m.assignment_id, m.url);
          }
        });

        // Map and extract unique technicians
        const uniqueTechs = new Set<string>();
        const mapped = appointments.map((a: any) => {
          const customer = profileMap.get(a.user_id);
          const property = propertyMap.get(a.property_id);
          const apptAssignments = assignmentsByAppt.get(a.id) || [];
          const firstAssignment = apptAssignments[0];
          const tech = firstAssignment ? techProfileMap.get(firstAssignment.employee_id) : null;
          const videoUrl = firstAssignment ? mediaByAssignment.get(firstAssignment.id) : undefined;

          if (tech?.name) uniqueTechs.add(tech.name);

          return {
            id: a.id,
            date: a.scheduled_at,
            customer_name: customer?.name || "Unknown",
            customer_email: customer?.email || "",
            property_address: property?.address || "Unknown",
            property_city: property?.city || "",
            technician_name: tech?.name,
            technician_email: tech?.email,
            notes: a.notes,
            status: a.status,
            video_url: videoUrl
          };
        });

        setVisits(mapped);
        setTechnicians(Array.from(uniqueTechs).sort());
      } catch (err) {
        console.error("[Visits] Exception:", err);
        setVisits([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadVisits();
  }, []);

  const filtered = useMemo(() => {
    return visits.filter((v) => {
      const date = v.date.slice(0, 10);
      const after = !from || date >= from;
      const before = !to || date <= to;
      const byTech = techFilter === "all" || v.technician_name === techFilter;
      return after && before && byTech;
    });
  }, [visits, from, to, techFilter]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading visit history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-8">
      <SectionHeading
        eyebrow="Visits"
        title="Service visit history"
        description="Completed appointments, technician details, and job media."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-40 rounded-lg"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-40 rounded-lg"
          />
        </div>
        <select
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
          value={techFilter}
          onChange={(e) => setTechFilter(e.target.value)}
        >
          <option value="all">All technicians</option>
          {technicians.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card/95 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-muted-foreground">No visits found for the selected filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="font-bold uppercase text-[10px]">Date</TableHead>
                  <TableHead className="font-bold uppercase text-[10px]">Customer</TableHead>
                  <TableHead className="font-bold uppercase text-[10px]">Property</TableHead>
                  <TableHead className="font-bold uppercase text-[10px]">Technician</TableHead>
                  <TableHead className="font-bold uppercase text-[10px]">Notes</TableHead>
                  <TableHead className="font-bold uppercase text-[10px]">Media</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((v) => (
                  <TableRow key={v.id} className="hover:bg-muted/20 border-border/40">
                    <TableCell className="font-medium text-sm">
                      {new Date(v.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{v.customer_name}</div>
                      <div className="text-xs text-muted-foreground">{v.customer_email}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {v.property_address}
                        {v.property_city && `, ${v.property_city}`}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{v.technician_name || "—"}</div>
                      {v.technician_email && (
                        <div className="text-xs text-muted-foreground">{v.technician_email}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-muted-foreground max-w-xs truncate">
                        {v.notes || "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      {v.video_url ? (
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="rounded-lg h-8"
                        >
                          <a href={v.video_url} target="_blank" rel="noreferrer">
                            <Play className="h-3 w-3 mr-1" />
                            View
                          </a>
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div className="text-sm text-muted-foreground">
        Showing {filtered.length} of {visits.length} visits
      </div>
    </div>
  );
};

export default Visits;
