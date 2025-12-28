import SectionHeading from "@/components/common/SectionHeading";
import { Button } from "@/components/ui/button";
import { customers, properties, invoices, visits, tickets } from "@/data/admin";
import { downloadCsv } from "@/lib/csv";

const Reports = () => {
  const exportCustomers = () =>
    downloadCsv(
      "customers.csv",
      customers.map((c) => ({ id: c.id, name: c.name, email: c.email, phone: c.phone, status: c.status, createdAt: c.createdAt }))
    );

  const exportProperties = () =>
    downloadCsv(
      "properties.csv",
      properties.map((p) => ({ id: p.id, customerId: p.customerId, address: `${p.address1}, ${p.city} ${p.zip}`, acreage: p.acreage }))
    );

  const exportInvoices = () =>
    downloadCsv(
      "invoices.csv",
      invoices.map((i) => ({ id: i.id, customerId: i.customerId, date: i.date, total: i.total, status: i.status, dueDate: i.dueDate }))
    );

  const exportVisits = () =>
    downloadCsv(
      "visits.csv",
      visits.map((v) => ({ id: v.id, propertyId: v.propertyId, customerId: v.customerId, date: v.date, technician: v.technician, chemicals: v.chemicals.join(";") }))
    );

  const exportTickets = () =>
    downloadCsv(
      "tickets.csv",
      tickets.map((t) => ({ id: t.id, customerId: t.customerId, propertyId: t.propertyId, subject: t.subject, priority: t.priority, status: t.status, createdAt: t.createdAt }))
    );

  return (
    <div className="grid gap-8">
      <SectionHeading
        eyebrow="Reports"
        title="Exports and analytics"
        description="CSV exports for customers, revenue, visits, chemicals, and SLA metrics."
      />

      <div className="grid gap-4 rounded-2xl border border-border/70 bg-card/95 p-4 sm:grid-cols-2 lg:grid-cols-3">
        <Button onClick={exportCustomers}>Export customers</Button>
        <Button onClick={exportProperties}>Export properties</Button>
        <Button onClick={exportInvoices}>Export invoices</Button>
        <Button onClick={exportVisits}>Export visits</Button>
        <Button onClick={exportTickets}>Export tickets</Button>
      </div>
    </div>
  );
};

export default Reports;
