import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import SectionHeading from "@/components/common/SectionHeading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { adminApi, AdminApiError } from "@/lib/adminApi";
import { GoogleAddressAutocomplete, type GoogleAddressAutocompleteResult } from "@/components/common/GoogleAddressAutocomplete";
import { CADENCE_DAYS_OPTIONS, CADENCE_LABELS, lookupAnnualCents, lookupCadenceCents, lookupOneTimeCents } from "@shared/pricing";
import { Loader2, MapPin, Mail, CheckCircle2, Link as LinkIcon, Copy, RotateCcw, ExternalLink } from "lucide-react";

type Program = "subscription" | "one_time" | "annual";

function formatCents(cents: number): string {
  return cents % 100 === 0 ? `$${(cents / 100).toFixed(0)}` : `$${(cents / 100).toFixed(2)}`;
}

interface QuoteResult {
  leadId: string | null;
  outOfServiceArea: boolean;
  normalizedAddress: string;
  county: string;
  acreage: number | null;
  confidence: string | null;
  oversized: boolean;
}

type LocationState = {
  leadId?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  name?: string;
  email?: string;
  phone?: string;
};

const AdminQuoteLookup = () => {
  const { toast } = useToast();
  const location = useLocation();
  const prefill = (location.state as LocationState) ?? {};

  const [address, setAddress] = useState(prefill.address ?? "");
  const [city, setCity] = useState(prefill.city ?? "");
  const [state, setState] = useState(prefill.state ?? "CA");
  const [zip, setZip] = useState(prefill.zip ?? "");
  const [lat, setLat] = useState<number | undefined>();
  const [lng, setLng] = useState<number | undefined>();
  const [placeId, setPlaceId] = useState<string | undefined>();

  const [isLookingUp, setIsLookingUp] = useState(false);
  const [result, setResult] = useState<QuoteResult | null>(null);
  const [manualAcreage, setManualAcreage] = useState("");

  const [selectedProgram, setSelectedProgram] = useState<Program>("subscription");
  const [selectedCadence, setSelectedCadence] = useState<number>(21);

  const [contactName, setContactName] = useState(prefill.name ?? "");
  const [contactEmail, setContactEmail] = useState(prefill.email ?? "");
  const [contactPhone, setContactPhone] = useState(prefill.phone ?? "");
  const [channel, setChannel] = useState<"email" | "sms" | "both">("email");
  const [isSending, setIsSending] = useState(false);
  const [sentResult, setSentResult] = useState<{ email: boolean; sms: boolean; quoteLinkUrl: string } | null>(null);

  // Arriving from an existing lead (LeadDetail's "Send Quote" action) --
  // load that lead's already-resolved data directly instead of re-running
  // the address/parcel lookup.
  useEffect(() => {
    if (!prefill.leadId) return;
    (async () => {
      setIsLookingUp(true);
      try {
        const data = await adminApi(`/api/admin/leads/${prefill.leadId}`);
        const lead = data.lead;
        setResult({
          leadId: lead.id,
          outOfServiceArea: false,
          normalizedAddress: lead.address || prefill.address || "",
          county: "unknown",
          acreage: lead.acreage,
          confidence: null,
          oversized: lead.acreage != null && lead.acreage > 2.0,
        });
        setManualAcreage(lead.acreage != null ? String(lead.acreage) : "0.1");
        if (lead.program === "subscription" || lead.program === "one_time" || lead.program === "annual") {
          setSelectedProgram(lead.program);
        }
        if (lead.cadence) setSelectedCadence(parseInt(lead.cadence, 10) || 21);
      } catch {
        toast({ title: "Couldn't load lead", description: "Falling back to a fresh address lookup.", variant: "destructive" });
      } finally {
        setIsLookingUp(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill.leadId]);

  const needsManualAcreage = Boolean(result?.oversized || (result && result.acreage == null));
  const effectiveAcreage = needsManualAcreage
    ? (parseFloat(manualAcreage) || null)
    : result?.acreage ?? null;

  const handlePlaceSelect = (place: GoogleAddressAutocompleteResult) => {
    setAddress(place.streetAddress || place.formattedAddress);
    if (place.city) setCity(place.city);
    if (place.state) setState(place.state);
    if (place.zip) setZip(place.zip);
    setLat(place.lat);
    setLng(place.lng);
    setPlaceId(place.placeId);
  };

  const handleLookup = async () => {
    if (!address.trim() || !zip.trim()) {
      toast({ title: "Missing details", description: "Enter a street address and ZIP code.", variant: "destructive" });
      return;
    }
    setIsLookingUp(true);
    setResult(null);
    setSentResult(null);
    try {
      const data = await adminApi("/api/admin/leads/quote", "POST", { address, city, state, zip, lat, lng, placeId });
      setResult({
        leadId: data.leadId,
        outOfServiceArea: data.outOfServiceArea,
        normalizedAddress: data.normalizedAddress,
        county: data.county,
        acreage: data.acreage,
        confidence: data.confidence,
        oversized: data.oversized,
      });
      setManualAcreage(data.acreage != null ? String(data.acreage) : "0.1");
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : "Quote lookup failed.";
      toast({ title: "Couldn't get a quote", description: message, variant: "destructive" });
    } finally {
      setIsLookingUp(false);
    }
  };

  const cadenceCents = effectiveAcreage != null ? lookupCadenceCents(effectiveAcreage, selectedCadence) : null;
  const annualCents = effectiveAcreage != null ? lookupAnnualCents(effectiveAcreage) : null;
  const oneTimeCents = effectiveAcreage != null ? lookupOneTimeCents(effectiveAcreage) : null;

  const handleSendQuote = async () => {
    if (!result?.leadId) return;
    if ((channel === "email" || channel === "both") && !contactEmail.trim()) {
      toast({ title: "Email required", description: "Enter the prospect's email to send by email.", variant: "destructive" });
      return;
    }
    if ((channel === "sms" || channel === "both") && !contactPhone.trim()) {
      toast({ title: "Phone required", description: "Enter the prospect's phone number to send by SMS.", variant: "destructive" });
      return;
    }

    setIsSending(true);
    try {
      const data = await adminApi(`/api/admin/leads/${result.leadId}/send-quote`, "POST", {
        channel,
        program: selectedProgram,
        cadenceDays: selectedProgram === "subscription" ? selectedCadence : undefined,
        acreage: needsManualAcreage ? effectiveAcreage ?? undefined : undefined,
        name: contactName || undefined,
        email: contactEmail || undefined,
        phone: contactPhone || undefined,
      });
      setSentResult({ email: data.sent.email, sms: data.sent.sms, quoteLinkUrl: data.quoteLinkUrl });
      toast({ title: "Quote sent", description: "The prospect can now sign up with their address and plan pre-filled." });
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : "Failed to send the quote.";
      toast({ title: "Couldn't send the quote", description: message, variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="grid gap-8">
      <SectionHeading
        eyebrow="Sales tool"
        title="Quote Lookup"
        description="Look up a prospect's address, generate a quote, and send it to them with a link to finish signing up."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Property Address</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="space-y-1.5">
            <Label>Street Address</Label>
            <GoogleAddressAutocomplete
              value={address}
              onChange={setAddress}
              onPlaceSelect={handlePlaceSelect}
              placeholder="e.g. 123 Oak Street"
              autoComplete="street-address"
            />
          </div>
          <div className="grid grid-cols-6 gap-3">
            <div className="col-span-3 space-y-1.5">
              <Label>City</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Anaheim" />
            </div>
            <div className="col-span-1 space-y-1.5">
              <Label>State</Label>
              <Input value={state} onChange={(e) => setState(e.target.value.toUpperCase())} maxLength={2} className="text-center uppercase" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>ZIP</Label>
              <Input value={zip} onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))} maxLength={5} placeholder="92801" />
            </div>
          </div>
          <Button onClick={handleLookup} disabled={isLookingUp} className="w-full sm:w-auto">
            {isLookingUp ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <MapPin className="h-4 w-4 mr-2" />}
            Get Quote
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              Quote
              {result.outOfServiceArea && <Badge variant="destructive">Out of service area</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="text-sm text-muted-foreground">
              {result.normalizedAddress}
              {result.county !== "unknown" && ` · ${result.county} County`}
              {result.acreage != null && ` · ${result.acreage} ac`}
              {result.confidence && ` · ${result.confidence} confidence`}
            </div>

            {result.outOfServiceArea ? (
              <p className="text-sm text-muted-foreground">This ZIP isn't in an active service area yet — a quote can't be sent for it.</p>
            ) : (
              <>
                {needsManualAcreage && (
                  <div className="space-y-1.5">
                    <Label>
                      {result.oversized
                        ? "This property's parcel is larger than our priced range — enter the treatment area size (acres)"
                        : "No acreage on file for this lead yet — enter the treatment area size (acres)"}
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={manualAcreage}
                      onChange={(e) => setManualAcreage(e.target.value)}
                      className="w-40"
                    />
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => setSelectedProgram("one_time")}
                    className={`rounded-xl border-2 p-4 text-left transition ${selectedProgram === "one_time" ? "border-primary bg-primary/5" : "border-border/60"}`}
                  >
                    <p className="text-sm font-bold">One-Time Treatment</p>
                    <p className="text-lg font-bold mt-1">{oneTimeCents != null ? formatCents(oneTimeCents) : "—"}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedProgram("subscription")}
                    className={`rounded-xl border-2 p-4 text-left transition ${selectedProgram === "subscription" ? "border-primary bg-primary/5" : "border-border/60"}`}
                  >
                    <p className="text-sm font-bold">Recurring Service</p>
                    <p className="text-lg font-bold mt-1">{cadenceCents != null ? `${formatCents(cadenceCents)} / visit` : "—"}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedProgram("annual")}
                    className={`rounded-xl border-2 p-4 text-left transition ${selectedProgram === "annual" ? "border-primary bg-primary/5" : "border-border/60"}`}
                  >
                    <p className="text-sm font-bold">Annual Plan</p>
                    <p className="text-lg font-bold mt-1">{annualCents != null ? `${formatCents(annualCents)} / yr` : "—"}</p>
                  </button>
                </div>

                {selectedProgram === "subscription" && (
                  <div className="flex flex-wrap gap-2">
                    {CADENCE_DAYS_OPTIONS.map((days) => {
                      const cents = effectiveAcreage != null ? lookupCadenceCents(effectiveAcreage, days) : null;
                      if (cents == null) return null;
                      return (
                        <button
                          key={days}
                          type="button"
                          onClick={() => setSelectedCadence(days)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${selectedCadence === days ? "border-primary bg-primary text-primary-foreground" : "border-border/60 text-muted-foreground"}`}
                        >
                          {CADENCE_LABELS[days]} — {formatCents(cents)}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-3 pt-2 border-t border-border/60">
                  <div className="space-y-1.5">
                    <Label>Name</Label>
                    <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Jane Smith" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="jane@example.com" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Phone</Label>
                    <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="(555) 555-0100" />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex gap-2">
                    {(["email", "sms", "both"] as const).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setChannel(c)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${channel === c ? "border-primary bg-primary text-primary-foreground" : "border-border/60 text-muted-foreground"}`}
                      >
                        {c === "email" ? "Email" : c === "sms" ? "Text" : "Email + Text"}
                      </button>
                    ))}
                  </div>
                  <Button onClick={handleSendQuote} disabled={isSending} className="ml-auto">
                    {isSending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                    Send Quote
                  </Button>
                </div>

                {sentResult && (
                  <div className="rounded-xl border border-green-200 bg-green-50 p-4 space-y-3">
                    <p className="text-sm font-semibold text-green-800 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" /> Quote sent successfully
                    </p>
                    <p className="text-xs text-green-700">
                      {sentResult.email && "Email delivered. "}
                      {sentResult.sms && "Text message sent. "}
                      The customer will see a branded setup page — not the generic login.
                    </p>
                    <div className="bg-white rounded-lg border border-green-100 p-3 space-y-2">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Invite link</p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground flex-1 truncate font-mono">{sentResult.quoteLinkUrl}</p>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(sentResult.quoteLinkUrl);
                            toast({ title: "Link copied to clipboard" });
                          }}
                          className="shrink-0 rounded-md border border-border/60 bg-background px-2 py-1 text-xs font-medium hover:bg-muted/60 flex items-center gap-1"
                        >
                          <Copy className="h-3 w-3" /> Copy
                        </button>
                        <a
                          href={sentResult.quoteLinkUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 rounded-md border border-border/60 bg-background px-2 py-1 text-xs font-medium hover:bg-muted/60 flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" /> Preview
                        </a>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => { setSentResult(null); }}
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 underline underline-offset-2"
                      >
                        <RotateCcw className="h-3 w-3" /> Resend or change channel
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminQuoteLookup;
