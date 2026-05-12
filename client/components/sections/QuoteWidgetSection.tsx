import { FormEvent, useEffect, useMemo, useState } from "react";
import { calculatePricing, formatCurrency, ProgramType } from "@/lib/pricing";
import { frequencyOptions } from "@/data/site";
import { Check, ChevronRight, MapPin, Loader, Search } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useScheduleDialog } from "@/components/schedule/ScheduleDialogProvider";
import { useTranslation } from "@/hooks/use-translation";
import { useToast } from "@/hooks/use-toast";
import { usePropertyLookup } from "@/hooks/use-property-lookup";
import { useAuth } from "@/contexts/AuthContext";

// Forced Refresh: 2025-05-22 11:20:00

type QuoteWidgetSectionProps = {
  id?: string;
};

const QuoteWidgetSection = ({ id }: QuoteWidgetSectionProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { lookup, isLoading: isSearching, error: searchError } = usePropertyLookup();
  const [acreage, setAcreage] = useState(0.2);
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [program, setProgram] = useState<ProgramType>("subscription");
  const [frequency, setFrequency] = useState<(typeof frequencyOptions)[number]>(21);
  const [submitted, setSubmitted] = useState(false);
  const { open } = useScheduleDialog();

  const programLabels: Record<ProgramType, string> = {
    subscription: t("pricing.subscription"),
    annual: t("pricing.annual"),
    one_time: "$179",
  };

  const pricing = useMemo(
    () => calculatePricing({ acreage, program, frequencyDays: frequency }),
    [acreage, program, frequency],
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);

    const preset = {
      serviceAddress: address,
      city: city,
      state: state,
      zipCode: zip,
      notes: `Estimated acreage: ${acreage} acres. Program: ${program}. Frequency: Every ${frequency} days.`,
    };

    if (!user) {
      navigate("/login", {
        state: {
          from: "/schedule",
          mode: "signup",
          preset
        }
      });
    } else {
      open({ source: "quote-widget", preset });
    }
  };

  const handleAddressSearch = async (e?: FormEvent) => {
    if (e) e.preventDefault();

    if (!address || !zip) {
      toast({
        title: "Missing details",
        description: "Please enter at least address and ZIP code.",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Estimating acreage...",
      description: "Searching parcel data for your property details.",
    });

    const data = await lookup(address, zip, city, state);
    if (data) {
      setAcreage(data.acreage);
      toast({
        title: "Address Found!",
        description: `We've estimated your property at ${data.acreage} acres. Pricing has been updated.`
      });
    }
    // Note: usePropertyLookup hook already has error state and could be used for more specific feedback if needed,
    // but the hook also returns null on failure.
  };

  // Effect to show error toast when searchError changes
  useEffect(() => {
    if (searchError) {
      toast({
        title: "Search Failed",
        description: searchError,
        variant: "destructive"
      });
    }
  }, [searchError, toast]);

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddressSearch();
    }
  };

  return (
    <section id={id} className="relative overflow-hidden bg-gradient-to-br from-background via-background to-primary/5 py-24">
      <div className="absolute inset-0 -z-10 bg-mesh-overlay opacity-40" aria-hidden />
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-primary">
              {t("quote.instant")}
            </span>
            <h2 className="font-display text-3xl font-semibold text-foreground sm:text-4xl">
              {t("quote.calculateTitle")}
            </h2>
            <p className="text-base text-muted-foreground">
              {t("quote.calculateDesc")}
            </p>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" aria-hidden />
                {t("quote.cadenceHint")}
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" aria-hidden />
                {t("quote.frequencyHint")}
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" aria-hidden />
                {t("quote.acreageHint")}
              </li>
            </ul>
          </div>
          <form
            onSubmit={handleSubmit}
            className="rounded-[32px] border border-primary/10 bg-card/90 p-6 shadow-soft lg:p-8"
          >
            <div className="grid gap-8">
              {/* Simplified Address Search - FORCED REFRESH */}
              <div id="schedule-form" className="space-y-6 rounded-2xl bg-primary/5 p-6 border border-primary/10 shadow-sm">
                <div className="flex items-center gap-2">
                  <Search className="h-5 w-5 text-primary" />
                  <p className="text-sm font-bold text-foreground uppercase tracking-widest">Search acreage by address</p>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-primary/80 ml-1">Street Address</label>
                    <input
                      placeholder="Street Address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      onKeyDown={handleInputKeyDown}
                      className="w-full rounded-xl border border-border/70 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-inner"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-primary/80 ml-1">City</label>
                      <input
                        placeholder="City"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        onKeyDown={handleInputKeyDown}
                        className="w-full rounded-xl border border-border/70 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-inner"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-primary/80 ml-1">State</label>
                      <input
                        placeholder="State"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        onKeyDown={handleInputKeyDown}
                        className="w-full rounded-xl border border-border/70 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-inner"
                      />
                    </div>
                    <div className="space-y-1.5 col-span-2 md:col-span-1">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-primary/80 ml-1">ZIP Code</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="ZIP"
                        value={zip}
                        onChange={(e) => setZip(e.target.value.replace(/[^0-9]/g, ""))}
                        onKeyDown={handleInputKeyDown}
                        maxLength={5}
                        className="w-full rounded-xl border border-border/70 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
                      />
                    </div>
                  </div>
                  
                  <Button
                    type="button"
                    onClick={() => handleAddressSearch()}
                    disabled={isSearching}
                    className="w-full rounded-xl h-12 shadow-brand bg-primary hover:bg-primary/90 transition-all font-bold text-base"
                  >
                    {isSearching ? (
                      <Loader className="h-6 w-6 animate-spin" />
                    ) : (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-5 w-5" />
                        <span>Search Property Acreage</span>
                      </div>
                    )}
                  </Button>
                </div>
                
                <p className="text-[11px] text-muted-foreground leading-tight italic">
                  Searching your address automatically sets the acreage slider for exact pricing.
                </p>
              </div>

              <label className="flex flex-col gap-2 text-sm font-semibold text-foreground">
                {t("quote.acreage")}
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min={0.05}
                    max={2.0}
                    step={0.01}
                    value={acreage}
                    onChange={(event) => setAcreage(Number(event.target.value))}
                    className="flex-1 accent-primary"
                    aria-label={t("quote.acreageLabel")}
                  />
                  <input
                    type="number"
                    min={0.05}
                    max={5}
                    step={0.01}
                    value={Number.isNaN(acreage) ? "" : acreage}
                    onChange={(event) => setAcreage(Number(event.target.value))}
                    className="w-28 rounded-2xl border border-border/70 bg-white px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/80"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("quote.needHelp")}
                </p>
              </label>

              <fieldset className="grid gap-3">
                <legend className="text-sm font-semibold text-foreground">{t("quote.program")}</legend>
                <div className="grid gap-3 sm:grid-cols-3">
                  {(Object.keys(programLabels) as ProgramType[]).map((value) => {
                    const isActive = program === value;
                    return (
                      <Button
                        key={value}
                        type="button"
                        variant={isActive ? "default" : "outline"}
                        onClick={() => setProgram(value)}
                        className={`rounded-2xl px-4 py-3 text-sm font-semibold h-auto ${
                          isActive ? "shadow-brand" : "bg-white text-muted-foreground hover:text-foreground hover:border-primary/50"
                        }`}
                      >
                        {programLabels[value]}
                      </Button>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset className="grid gap-3">
                <legend className="text-sm font-semibold text-foreground">{t("quote.frequency")}</legend>
                <div className="grid grid-cols-4 gap-3 text-sm">
                  {frequencyOptions.map((option) => {
                    const isActive = frequency === option;
                    return (
                      <Button
                        key={option}
                        type="button"
                        variant={isActive ? "default" : "outline"}
                        onClick={() => setFrequency(option)}
                        className={`rounded-2xl px-4 py-3 font-semibold h-auto ${
                          isActive ? "shadow-brand bg-primary/90" : "bg-white text-muted-foreground hover:text-foreground hover:border-primary/50"
                        }`}
                        aria-pressed={isActive}
                      >
                        {option}
                      </Button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="grid gap-3 rounded-3xl bg-muted/50 p-6">
                <div className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
                  <span>{t("quote.perVisit")}</span>
                  <span className="text-xl font-semibold text-foreground">{formatCurrency(pricing.perVisit)}</span>
                </div>
                <div className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
                  <span>{t("quote.monthlyEq")}</span>
                  <span className="text-xl font-semibold text-foreground">{formatCurrency(pricing.perMonth)}</span>
                </div>
                <div className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
                  <span>{t("quote.annualTotal")}</span>
                  <span className="text-xl font-semibold text-foreground">{formatCurrency(pricing.annualTotal)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("quote.visitsPerYear")}{pricing.visitsPerYear ?? "—"}
                </p>
                {pricing.message ? (
                  <p className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-3 text-xs text-primary">
                    {pricing.message}
                  </p>
                ) : null}
              </div>

              {pricing.isCustom ? (
                <Button
                  asChild
                  variant="outline"
                  className="rounded-full px-6 py-3 h-auto"
                >
                  <Link to="/contact">
                    {t("quote.customWalkthrough")}
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </Link>
                </Button>
              ) : (
                <Button
                  type="submit"
                  className="rounded-full px-6 py-3 h-auto shadow-brand"
                >
                  {t("quote.saveQuote")}
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </Button>
              )}

              {submitted && !pricing.isCustom ? (
                <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 text-sm text-primary">
                  {t("quote.quoteSaved")}
                </div>
              ) : null}
            </div>
          </form>
        </div>
      </div>
    </section>
  );
};

export default QuoteWidgetSection;
