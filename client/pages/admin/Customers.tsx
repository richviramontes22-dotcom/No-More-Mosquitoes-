import { useMemo, useState } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  customers as seedCustomers,
  properties as seedProperties,
  invoices as seedInvoices,
  messages as seedMessages,
  getCustomerProperties,
  getCustomerInvoices,
  getCustomerMessages,
  Customer,
  CustomerStatus,
  findCustomer,
} from "@/data/admin";
import { formatCurrency } from "@/lib/pricing";

const statusColors: Record<CustomerStatus, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  paused: "secondary",
  canceled: "destructive",
};

const Customers = () => {
  const [customers, setCustomers] = useState<Customer[]>(() => seedCustomers.slice());
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<CustomerStatus | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers.filter((c) => {
      const matchesQuery = !q || `${c.name} ${c.email} ${c.phone}`.toLowerCase().includes(q);
      const matchesStatus = status === "all" || c.status === status;
      return matchesQuery && matchesStatus;
    });
  }, [customers, query, status]);

  const selected = selectedId ? customers.find((c) => c.id === selectedId) ?? null : null;

  const addCustomer = (c: Omit<Customer, "id">) => {
    const next: Customer = { ...c, id: `c_${Math.floor(Math.random() * 1e6)}` };
    setCustomers((prev) => [next, ...prev]);
  };

  return (
    <div className="grid gap-8">
      <SectionHeading
        eyebrow="Customers"
        title="Search and manage customers"
        description="View profiles, properties, subscriptions, invoices, and messages."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <Input
            placeholder="Search name, email, or phone"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-72"
          />
          <select
            aria-label="Filter by status"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="canceled">Canceled</option>
          </select>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <Button>Add customer</Button>
          </DialogTrigger>
          <NewCustomerDialog onCreate={addCustomer} />
        </Dialog>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card/95 p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Properties</TableHead>
              <TableHead>Since</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.email}</TableCell>
                <TableCell>{c.phone}</TableCell>
                <TableCell>{getCustomerProperties(c.id).length}</TableCell>
                <TableCell>{new Date(c.createdAt).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Badge variant={statusColors[c.status]} className="capitalize">
                    {c.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button variant="outline" size="sm" onClick={() => setSelectedId(c.id)}>
                        View
                      </Button>
                    </SheetTrigger>
                    <CustomerDetailsSheet customerId={c.id} />
                  </Sheet>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

const CustomerDetailsSheet = ({ customerId }: { customerId: string }) => {
  const c = findCustomer(customerId);
  const props = getCustomerProperties(customerId);
  const inv = getCustomerInvoices(customerId);
  const threads = getCustomerMessages(customerId);

  return (
    <SheetContent className="w-full sm:max-w-2xl">
      <SheetHeader>
        <SheetTitle>{c.name}</SheetTitle>
        <SheetDescription>
          {c.email} · {c.phone}
        </SheetDescription>
      </SheetHeader>

      <Tabs defaultValue="profile" className="mt-4">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="properties">Properties</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <div className="grid gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Status</div>
              <div className="mt-1 font-medium capitalize">{c.status}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Customer since</div>
              <div className="mt-1 font-medium">{new Date(c.createdAt).toLocaleDateString()}</div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="properties" className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Acreage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {props.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.label}</TableCell>
                  <TableCell>
                    {p.address1}, {p.city} {p.zip}
                  </TableCell>
                  <TableCell>{p.acreage}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="invoices" className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inv.map((i) => (
                <TableRow key={i.id}>
                  <TableCell>{new Date(i.date).toLocaleDateString()}</TableCell>
                  <TableCell>{formatCurrency(i.total)}</TableCell>
                  <TableCell className="capitalize">{i.status}</TableCell>
                  <TableCell>{new Date(i.dueDate).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="messages" className="mt-4">
          <div className="grid gap-4">
            {threads.map((t) => (
              <div key={t.id} className="rounded-xl border p-4">
                <div className="flex items-center justify-between text-sm">
                  <div className="font-medium">{t.subject}</div>
                  <div className="text-muted-foreground">
                    {new Date(t.lastMessageAt).toLocaleString()}
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {t.messages.map((m) => (
                    <div key={m.id} className="text-sm">
                      <span className="mr-2 rounded bg-muted px-2 py-0.5 text-muted-foreground">{m.from}</span>
                      <span>{m.body}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </SheetContent>
  );
};

const NewCustomerDialog = ({ onCreate }: { onCreate: (c: Omit<Customer, "id">) => void }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<CustomerStatus>("active");

  const valid = name.trim() && /.+@.+/.test(email) && phone.trim();

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>New customer</DialogTitle>
        <DialogDescription>Create a new customer profile.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-3">
        <div>
          <label htmlFor="c-name" className="text-sm font-medium">
            Name
          </label>
          <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label htmlFor="c-email" className="text-sm font-medium">
            Email
          </label>
          <Input id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label htmlFor="c-phone" className="text-sm font-medium">
            Phone
          </label>
          <Input id="c-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <label htmlFor="c-status" className="text-sm font-medium">
            Status
          </label>
          <select
            id="c-status"
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as CustomerStatus)}
          >
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="canceled">Canceled</option>
          </select>
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={!valid}
          onClick={() => {
            if (!valid) return;
            onCreate({ name: name.trim(), email: email.trim(), phone: phone.trim(), status, createdAt: new Date().toISOString() });
          }}
        >
          Create
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};

export default Customers;
