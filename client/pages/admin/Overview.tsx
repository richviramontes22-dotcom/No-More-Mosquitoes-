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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  Calendar,
  Ticket,
  DollarSign,
  AlertCircle,
  MessageSquare,
  ArrowUpRight,
  TrendingUp
} from "lucide-react";

const Overview = () => {
  const kpis = [
    { label: "Active customers", value: activeCustomerCount().toString(), icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Appointments today", value: appointmentsTodayCount().toString(), icon: Calendar, color: "text-primary", bg: "bg-primary/10" },
    { label: "Open tickets", value: openTicketCount().toString(), icon: Ticket, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "MTD revenue", value: formatCurrency(monthToDateRevenue()), icon: DollarSign, color: "text-green-600", bg: "bg-green-50" },
    { label: "Overdue invoices", value: overdueInvoiceCount().toString(), icon: AlertCircle, color: "text-destructive", bg: "bg-destructive/10" },
    { label: "Unread messages", value: unreadMessagesCount().toString(), icon: MessageSquare, color: "text-purple-600", bg: "bg-purple-50" },
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
    <div className="grid gap-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <SectionHeading
          eyebrow="Admin Overview"
          title="Today’s operations at a glance"
          description="Monitor customers, appointments, tickets, revenue, and messages."
        />
        <div className="flex items-center gap-2 bg-primary/5 px-4 py-2 rounded-full border border-primary/10">
          <TrendingUp className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-primary">System healthy</span>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {kpis.map((k) => (
          <Card key={k.label} className="rounded-[28px] border-border/60 bg-card/95 shadow-soft overflow-hidden transition-all hover:shadow-md group">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">{k.label}</p>
                  <p className="text-3xl font-display font-bold text-foreground">{k.value}</p>
                </div>
                <div className={`h-12 w-12 rounded-2xl ${k.bg} ${k.color} flex items-center justify-center transition-transform group-hover:scale-110`}>
                  <k.icon className="h-6 w-6" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-1 text-[10px] font-bold text-green-600 uppercase tracking-wider">
                <ArrowUpRight className="h-3 w-3" />
                <span>+12% from last week</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card className="rounded-[32px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
          <CardHeader className="border-b border-border/40 bg-muted/20 px-8 py-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-display font-bold">Upcoming Appointments</CardTitle>
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">Next 24h</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 border-none">
                    <TableHead className="pl-8 py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Date/Time</TableHead>
                    <TableHead className="py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Customer</TableHead>
                    <TableHead className="py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Property</TableHead>
                    <TableHead className="pr-8 py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest text-right">Tech</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {upcoming.map((a) => {
                    const cust = findCustomer(a.customerId);
                    const prop = findProperty(a.propertyId);
                    return (
                      <TableRow key={a.id} className="hover:bg-muted/20 transition-colors border-border/40">
                        <TableCell className="pl-8 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-sm">{a.date}</span>
                            <span className="text-xs text-muted-foreground">{a.startTime}–{a.endTime}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-4 font-medium text-sm">{cust.name}</TableCell>
                        <TableCell className="py-4 text-xs text-muted-foreground italic">
                          {prop.address1}, {prop.city}
                        </TableCell>
                        <TableCell className="pr-8 py-4 text-right">
                          <Badge variant="secondary" className="bg-muted text-foreground hover:bg-muted border-none text-[10px]">{a.technician}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[32px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
          <CardHeader className="border-b border-border/40 bg-muted/20 px-8 py-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-display font-bold">Recent Support Tickets</CardTitle>
              <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200">Attention Required</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 border-none">
                    <TableHead className="pl-8 py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Subject</TableHead>
                    <TableHead className="py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Priority</TableHead>
                    <TableHead className="pr-8 py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTickets.map((t) => (
                    <TableRow key={t.id} className="hover:bg-muted/20 transition-colors border-border/40">
                      <TableCell className="pl-8 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-sm line-clamp-1">{t.subject}</span>
                          <span className="text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge
                          variant="outline"
                          className={`text-[10px] uppercase tracking-wider ${
                            t.priority === "high" ? "bg-red-50 text-red-600 border-red-200" :
                            t.priority === "medium" ? "bg-amber-50 text-amber-600 border-amber-200" :
                            "bg-blue-50 text-blue-600 border-blue-200"
                          }`}
                        >
                          {t.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-8 py-4 text-right">
                        <span className="text-xs font-bold capitalize">{t.status.replace("_", " ")}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[32px] border-border/60 bg-card/95 shadow-soft overflow-hidden mb-10">
        <CardHeader className="border-b border-border/40 bg-muted/20 px-8 py-6">
          <CardTitle className="text-lg font-display font-bold">Newest Customers</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 border-none">
                  <TableHead className="pl-8 py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Customer</TableHead>
                  <TableHead className="py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Contact Info</TableHead>
                  <TableHead className="py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Joined Date</TableHead>
                  <TableHead className="pr-8 py-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {newCustomers.map((c) => (
                  <TableRow key={c.id} className="hover:bg-muted/20 transition-colors border-border/40">
                    <TableCell className="pl-8 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                          {c.name.charAt(0)}
                        </div>
                        <span className="font-bold text-sm">{c.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex flex-col text-xs text-muted-foreground">
                        <span>{c.email}</span>
                        <span>{c.phone}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 text-sm font-medium">
                      {new Date(c.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </TableCell>
                    <TableCell className="pr-8 py-4 text-right">
                      <Badge className={c.status === "active" ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}>
                        {c.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Overview;
