import { PageHero, CtaBand } from "@/components/page";
import Seo from "@/components/seo/Seo";
import { CheckCircle2, ShieldCheck, Phone } from "lucide-react";
import { siteConfig } from "@/data/site";
import { useSiteContent } from "@/hooks/useSiteContent";

const guaranteePoints = [
  {
    title: "Mosquitoes return between visits",
    detail: "If you see mosquito activity within 7 days of your last scheduled visit, contact us and we will re-service at no charge.",
  },
  {
    title: "Ants, ticks, or spiders included in your program",
    detail: "Our guarantee covers all pests listed in your active service plan, not just mosquitoes.",
  },
  {
    title: "Same-week re-service",
    detail: "We prioritize re-service requests and aim to return within 48–72 hours of your report.",
  },
  {
    title: "No forms, no hassle",
    detail: "Call, text, or message through your portal. No approval process — if you report it, we treat it.",
  },
];

const exclusions = [
  "Re-service requests submitted more than 7 days after the prior treatment",
  "Properties where access was denied or restricted at the time of the original visit",
  "Treatment areas disturbed or washed within 48 hours of service",
  "Pests not included in your active service plan",
  "New infestations introduced from neighboring properties beyond our treated zones",
];

const Guarantee = () => {
  const cmsGuaranteeText = useSiteContent("guarantee_text");
  const heroDescription = cmsGuaranteeText || "If covered pests return between scheduled visits, we come back — at no charge, no questions asked.";

  return (
  <div className="flex flex-col gap-0">
    <Seo
      title="Satisfaction Guarantee | No More Mosquitoes"
      description="Our 100% satisfaction guarantee: if mosquitoes or covered pests return between visits, we re-service at no charge."
      canonicalUrl="https://nomoremosquitoes.us/guarantee"
    />
    <PageHero
      variant="centered"
      eyebrow="Our Promise"
      title="100% Satisfaction Guarantee"
      description={heroDescription}
      primaryCta={{ label: "Schedule Service", href: "/schedule" }}
    />

    <section className="bg-background py-16 md:py-24">
      <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 space-y-16">

        {/* What's covered */}
        <div className="space-y-8">
          <div className="text-center space-y-2">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary/70">What's covered</p>
            <h2 className="text-3xl font-bold font-display">We stand behind every visit</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">Our guarantee applies to all active subscription customers. Here's exactly what it covers.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {guaranteePoints.map((point) => (
              <div key={point.title} className="flex gap-4 rounded-[24px] border border-border/60 bg-card/90 p-6 shadow-sm">
                <CheckCircle2 className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-foreground mb-1">{point.title}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{point.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* How to claim */}
        <div className="rounded-[32px] bg-primary/5 border border-primary/10 p-8 md:p-12 space-y-6">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-primary" />
            <h2 className="text-2xl font-bold font-display">How to request a re-service</h2>
          </div>
          <ol className="space-y-4 text-sm text-foreground">
            <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">1</span><span>Contact us within <strong>7 days</strong> of your last treatment by phone, text, or through your customer portal.</span></li>
            <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">2</span><span>Describe what you're seeing and where (patio, yard perimeter, standing water area, etc.).</span></li>
            <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">3</span><span>We'll schedule your no-charge re-service within 48–72 hours.</span></li>
          </ol>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <a href={siteConfig.phone.link} className="inline-flex items-center gap-2 rounded-full border border-border/60 px-5 py-2.5 text-sm font-semibold hover:border-primary/50 hover:text-primary transition">
              <Phone className="h-4 w-4" /> Call or Text {siteConfig.phone.display}
            </a>
            <a href="/dashboard/support" className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-brand hover:bg-primary/90 transition">
              Message Through Portal
            </a>
          </div>
        </div>

        {/* Exclusions */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold font-display">Guarantee exclusions</h2>
          <ul className="space-y-3">
            {exclusions.map((e) => (
              <li key={e} className="flex gap-3 text-sm text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                {e}
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">Questions about whether your situation qualifies? Contact us — we'll always give you the benefit of the doubt.</p>
        </div>

      </div>
    </section>

    <CtaBand
      title="Ready for a yard you can actually enjoy?"
      href="/schedule"
      ctaLabel="Schedule Service"
      description="Every visit is backed by our 100% satisfaction guarantee."
    />
  </div>
  );
};

export default Guarantee;
