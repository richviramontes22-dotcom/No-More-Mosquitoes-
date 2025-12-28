import { useMemo, useState } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { visits as seed, findCustomer, findProperty, technicians } from "@/data/admin";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";

const Visits = () => {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [tech, setTech] = useState<string | "all">("all");

  const filtered = useMemo(() => {
    return seed.filter((v) => {
      const date = v.date.slice(0, 10);
      const after = !from || date >= from;
      const before = !to || date <= to;
      const byTech = tech === "all" || v.technician === tech;
      return after && before && byTech;
    });
  }, [from, to, tech]);

  return (
    <div className="grid gap-8">
      <SectionHeading
        eyebrow="Visits"
        title="Service visit history"
        description="Completion reports, chemicals used, photos, and video URLs."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          <span className="text-sm text-muted-foreground">to</span>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={tech} onChange={(e) => setTech(e.target.value)}>
          <option value="all">All technicians</option>
          {technicians.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card/95 p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Property</TableHead>
              <TableHead>Chemicals</TableHead>
              <TableHead>Technician</TableHead>
              <TableHead>Video</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((v) => {
              const c = findCustomer(v.customerId);
              const p = findProperty(v.propertyId);
              return (
                <TableRow key={v.id}>
                  <TableCell>{new Date(v.date).toLocaleDateString()}</TableCell>
                  <TableCell>{c.name}</TableCell>
                  <TableCell>
                    {p.address1}, {p.city}
                  </TableCell>
                  <TableCell className="text-xs">{v.chemicals.join(", ")}</TableCell>
                  <TableCell>{v.technician}</TableCell>
                  <TableCell>
                    {v.videoUrl ? (
                      <a className="text-primary underline" href={v.videoUrl} target="_blank" rel="noreferrer">
                        View
                      </a>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Visits;
