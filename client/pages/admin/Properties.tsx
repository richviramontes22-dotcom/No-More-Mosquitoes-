import { useMemo, useState } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { properties as seed, Property, findCustomer } from "@/data/admin";

const Properties = () => {
  const [items, setItems] = useState<Property[]>(() => seed.slice());
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((p) => `${p.address1} ${p.city} ${p.state} ${p.zip}`.toLowerCase().includes(q));
  }, [items, query]);

  const addProperty = (p: Omit<Property, "id">) => {
    const next: Property = { ...p, id: `p_${Math.floor(Math.random() * 1e6)}` };
    setItems((prev) => [next, ...prev]);
  };

  return (
    <div className="grid gap-8">
      <SectionHeading
        eyebrow="Properties"
        title="Customer properties"
        description="Manage addresses, acreage, and notes for each customer."
      />

      <div className="flex items-center justify-between gap-3">
        <Input placeholder="Search address or city" className="w-72" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Dialog>
          <DialogTrigger asChild>
            <Button>Add property</Button>
          </DialogTrigger>
          <NewPropertyDialog onCreate={addProperty} />
        </Dialog>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card/95 p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Address</TableHead>
              <TableHead>City</TableHead>
              <TableHead>ZIP</TableHead>
              <TableHead>Acreage</TableHead>
              <TableHead>Customer</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.address1}</TableCell>
                <TableCell>{p.city}</TableCell>
                <TableCell>{p.zip}</TableCell>
                <TableCell>{p.acreage}</TableCell>
                <TableCell>{findCustomer(p.customerId).name}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

const NewPropertyDialog = ({ onCreate }: { onCreate: (p: Omit<Property, "id">) => void }) => {
  const [customerId, setCustomerId] = useState("");
  const [label, setLabel] = useState("Home");
  const [address1, setAddress1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("CA");
  const [zip, setZip] = useState("");
  const [acreage, setAcreage] = useState(0.2);

  const valid = customerId && address1.trim() && city.trim() && zip.trim();

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>New property</DialogTitle>
        <DialogDescription>Attach a property to an existing customer.</DialogDescription>
      </DialogHeader>

      <div className="grid gap-3">
        <div>
          <label className="text-sm font-medium">Customer</label>
          <select
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            <option value="">Select customer</option>
            {Array.from(new Set(seed.map((p) => p.customerId))).map((cid) => (
              <option key={cid} value={cid}>
                {findCustomer(cid).name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Label</label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-medium">Address</label>
          <Input value={address1} onChange={(e) => setAddress1(e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-sm font-medium">City</label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">State</label>
            <Input value={state} onChange={(e) => setState(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">ZIP</label>
            <Input value={zip} onChange={(e) => setZip(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">Acreage</label>
          <Input type="number" step="0.01" value={acreage} onChange={(e) => setAcreage(parseFloat(e.target.value))} />
        </div>
      </div>

      <DialogFooter>
        <Button
          disabled={!valid}
          onClick={() =>
            onCreate({ customerId, label: label.trim(), address1: address1.trim(), city: city.trim(), state: state.trim(), zip: zip.trim(), acreage, notes: "" })
          }
        >
          Create
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};

export default Properties;
