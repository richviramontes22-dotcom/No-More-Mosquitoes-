import SectionHeading from "@/components/common/SectionHeading";
import { appointments, tickets, invoices, customers as allCustomers } from "@/data/admin";
import {
  activeCustomerCount,
  appointmentsTodayCount,
  monthToDateRevenue,
  overdueInvoiceCount,
  openTicketCount,
  unreadMessagesCount,
  findCustomer,
  findProperty,
} from "@/data/admin";
import { formatCurrency } from "@/lib/pricing";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const Overview = () => {
  const kpis = [
    { label: "Active customers", value: activeCustomerCount().toString() },
    { label: "Appointments today", value: appointmentsTodayCount().toString() },
    { label: "Open tickets", value: openTicketCount().toString() },
    { label: "MTD revenue", value: formatCurrency(monthToDateRevenue()) },
    { label: "Overdue invoices", value: overdueInvoiceCount().toString() },
    { label: "Unread messages", value: unreadMessagesCount().toString() },
  ];

  const upcoming = appointments
    .filter((a) => a.status === "scheduled")
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
    .slice(0, 5);

  const recentTickets = tickets
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  const newCustomers = allCustomers
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  return (
    <div className="grid gap-8">
      <SectionHeading
        eyebrow="Admin Overview"
        title="Today’s operations at a glance"
        description="Monitor customers, appointments, tickets, revenue, and messages."
      />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-border/70 bg-card/95 p-6">
            <p className="text-sm font-semibold text-foreground">{k.label}</p>
            <p className="mt-2 text-3xl font-display text-foreground">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border/70 bg-card/95 p-6">
          <p className="text-sm font-semibold text-foreground">Upcoming appointments</p>
          <Table className="mt-4">
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Tech</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {upcoming.map((a) => {
                const cust = findCustomer(a.customerId);
                const prop = findProperty(a.propertyId);
                return (
                  <TableRow key={a.id}>
                    <TableCell>{a.date}</TableCell>
                    <TableCell>
                      {a.startTime}–{a.endTime}
                    </TableCell>
                    <TableCell>{cust.name}</TableCell>
                    <TableCell>
                      {prop.address1}, {prop.city}
                    </TableCell>
                    <TableCell>{a.technician}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card/95 p-6">
          <p className="text-sm font-semibold text-foreground">Recent tickets</p>
          <Table className="mt-4">
            <TableHeader>
              <TableRow>
                <TableHead>Created</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentTickets.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{new Date(t.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>{t.subject}</TableCell>
                  <TableCell className="capitalize">{t.priority.replace("_", " ")}</TableCell>
                  <TableCell className="capitalize">{t.status.replace("_", " ")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card/95 p-6">
        <p className="text-sm font-semibold text-foreground">Newest customers</p>
        <Table className="mt-4">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {newCustomers.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.name}</TableCell>
                <TableCell>{c.email}</TableCell>
                <TableCell>{c.phone}</TableCell>
                <TableCell>{new Date(c.createdAt).toLocaleDateString()}</TableCell>
                <TableCell className="capitalize">{c.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Overview;
