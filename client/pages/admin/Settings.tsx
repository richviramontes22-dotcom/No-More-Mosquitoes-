import { useState } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";

export type TeamRole = "admin" | "support";
export type TeamMember = { id: string; name: string; email: string; role: TeamRole };

const seedTeam: TeamMember[] = [
  { id: "u_1", name: "Elijah Noble", email: "owner@example.com", role: "admin" },
  { id: "u_2", name: "Ana Ramirez", email: "support@example.com", role: "support" },
];

const Settings = () => {
  const [team, setTeam] = useState<TeamMember[]>(() => seedTeam.slice());
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("support");

  const [flags, setFlags] = useState({
    autoAssignTickets: true,
    requireCompletionVideo: true,
    enableReserviceRequests: true,
    smsReminders: true,
  });

  const [integrations, setIntegrations] = useState({
    supabase: false,
    stripe: false,
    netlify: false,
    builder: false,
    neon: false,
    prisma: false,
    notion: false,
    zapier: false,
    sentry: false,
    context7: false,
  });

  const validInvite = name.trim() && /.+@.+/.test(email);

  const removeMember = (id: string) => setTeam((prev) => prev.filter((m) => m.id !== id));
  const updateRole = (id: string, r: TeamRole) => setTeam((prev) => prev.map((m) => (m.id === id ? { ...m, role: r } : m)));

  return (
    <div className="grid gap-8">
      <SectionHeading
        eyebrow="Settings"
        title="Team, roles, and integrations"
        description="Manage team members, roles, feature flags, and integrations."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border/70 bg-card/95 p-4">
          <div className="text-sm font-semibold">Team</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
            <Input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={role} onChange={(e) => setRole(e.target.value as TeamRole)}>
              <option value="support">Support</option>
              <option value="admin">Admin</option>
            </select>
            <Button
              disabled={!validInvite}
              onClick={() => {
                setTeam((prev) => [{ id: `u_${Math.floor(Math.random() * 1e6)}`, name: name.trim(), email: email.trim(), role }, ...prev]);
                setName("");
                setEmail("");
                setRole("support");
              }}
            >
              Invite
            </Button>
          </div>
          <div className="mt-4 rounded-xl border p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {team.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell>{m.email}</TableCell>
                    <TableCell>
                      <select
                        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                        value={m.role}
                        onChange={(e) => updateRole(m.id, e.target.value as TeamRole)}
                      >
                        <option value="support">Support</option>
                        <option value="admin">Admin</option>
                      </select>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => removeMember(m.id)}>
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card/95 p-4">
          <div className="text-sm font-semibold">Feature flags</div>
          <div className="mt-3 space-y-3">
            <FlagRow
              label="Auto-assign new tickets to on-call tech"
              checked={flags.autoAssignTickets}
              onChange={(b) => setFlags((f) => ({ ...f, autoAssignTickets: b }))}
            />
            <FlagRow
              label="Require completion video for visit to close"
              checked={flags.requireCompletionVideo}
              onChange={(b) => setFlags((f) => ({ ...f, requireCompletionVideo: b }))}
            />
            <FlagRow
              label="Enable customer re-service requests"
              checked={flags.enableReserviceRequests}
              onChange={(b) => setFlags((f) => ({ ...f, enableReserviceRequests: b }))}
            />
            <FlagRow
              label="Send SMS appointment reminders"
              checked={flags.smsReminders}
              onChange={(b) => setFlags((f) => ({ ...f, smsReminders: b }))}
            />
          </div>

          <div className="mt-6 text-sm font-semibold">Integrations</div>
          <div className="mt-3 space-y-3">
            <FlagRow label="Supabase (auth, DB)" checked={integrations.supabase} onChange={(b) => setIntegrations((s) => ({ ...s, supabase: b }))} />
            <FlagRow label="Stripe (billing)" checked={integrations.stripe} onChange={(b) => setIntegrations((s) => ({ ...s, stripe: b }))} />
            <FlagRow label="Netlify (hosting)" checked={integrations.netlify} onChange={(b) => setIntegrations((s) => ({ ...s, netlify: b }))} />
            <FlagRow label="Builder CMS (content)" checked={integrations.builder} onChange={(b) => setIntegrations((s) => ({ ...s, builder: b }))} />
            <FlagRow label="Neon (postgres)" checked={integrations.neon} onChange={(b) => setIntegrations((s) => ({ ...s, neon: b }))} />
            <FlagRow label="Prisma (ORM)" checked={integrations.prisma} onChange={(b) => setIntegrations((s) => ({ ...s, prisma: b }))} />
            <FlagRow label="Notion (docs)" checked={integrations.notion} onChange={(b) => setIntegrations((s) => ({ ...s, notion: b }))} />
            <FlagRow label="Zapier (automation)" checked={integrations.zapier} onChange={(b) => setIntegrations((s) => ({ ...s, zapier: b }))} />
            <FlagRow label="Sentry (errors)" checked={integrations.sentry} onChange={(b) => setIntegrations((s) => ({ ...s, sentry: b }))} />
            <FlagRow label="Context7 (docs)" checked={integrations.context7} onChange={(b) => setIntegrations((s) => ({ ...s, context7: b }))} />
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={() => window.location.reload()}>Discard</Button>
            <Button onClick={() => alert("Saved settings for current session.")}>Save</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

const FlagRow = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (b: boolean) => void }) => {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
};

export default Settings;
