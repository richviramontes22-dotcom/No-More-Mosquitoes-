import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, RefreshCw, DollarSign } from "lucide-react";
import PlanCardsSection from "@/components/sections/PlanCardsSection";
import FAQSection from "@/components/sections/FAQSection";
import QuoteWidgetSection from "@/components/sections/QuoteWidgetSection";
import { CtaBand } from "@/components/page";
import Seo from "@/components/seo/Seo";
import { productSchema } from "@/seo/structuredData";

const trustItems = [
  {
    icon: <DollarSign className="h-5 w-5" />,
    label: "Pricing adjusts automatically for acreage changes",
  },
  {
    icon: <ShieldCheck className="h-5 w-5" />,
    label: "Annual prepay discount available on every tier",
  },
  {
    icon: <RefreshCw className="h-5 w-5" />,
    label: "100% re-service guarantee between visits",
  },
];

const Pricing = () => {
  return (
    <div className="flex flex-col gap-0">
      <Seo
        title="Pricing & Plans | No More Mosquitoes (Orange County)"
        description="Acreage-based insect control pricing with 14/21/30/42-day options. Annual prepay and one-time application available."
        canonicalUrl="https://nomoremosquitoes.us/pricing"
        jsonLd={[productSchema]}
      />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 via-background to-background py-20 sm:py-28">
        {/* Decorative flag images */}
        <img
          src="https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2Faa7545ec62e74376aa3a6851bb458990?format=webp&width=800"
          alt=""
          aria-hidden
          className="pointer-events-none select-none hidden lg:block absolute left-0 top-1/2 -translate-y-1/2 -translate-x-16 w-52 opacity-20 rounded"
        />
        <img
          src="https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F044b876fa399404ca8e3d2f1eb4fcbb5?format=webp&width=800"
          alt=""
          aria-hidden
          className="pointer-events-none select-none hidden lg:block absolute right-0 top-1/2 -translate-y-1/2 translate-x-16 h-36 w-auto opacity-20 rounded"
        />

        <div className="relative mx-auto w-full max-w-3xl px-4 sm:px-6 text-center space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-primary">
            Transparent Pricing
          </span>
          <h1 className="font-display text-3xl font-semibold sm:text-5xl leading-tight">
            100% non-toxic, California-approved protection
          </h1>
          <p className="text-base text-muted-foreground max-w-xl mx-auto">
            Tough on pests, safe for pets, and made with your family's well-being in mind.{" "}
            <Link to="/safety" className="font-semibold text-primary underline-offset-4 hover:underline inline-flex items-center gap-1">
              Learn more <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </p>

          {/* Trust strip */}
          <ul className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 mt-2">
            {trustItems.map(item => (
              <li key={item.label} className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary flex-shrink-0">
                  {item.icon}
                </span>
                {item.label}
              </li>
            ))}
          </ul>

          <a
            href="#quote"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-brand transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Get My Quote
            <ArrowRight className="h-4 w-4" aria-hidden />
          </a>
        </div>
      </section>

      {/* ── Quote flow: address → plan selector ── */}
      <QuoteWidgetSection id="quote" />

      {/* ── Plan features / marketing detail ── */}
      <PlanCardsSection />

      {/* ── FAQ ── */}
      <FAQSection ids={["pricing", "safety", "weather"]} searchable />

      {/* ── Bottom CTA ── */}
      <CtaBand
        title="Need a custom acreage walkthrough?"
        href="/schedule"
        ctaLabel="Schedule a walkthrough"
        description="Larger than two acres or have complex terrain?"
      />
    </div>
  );
};

export default Pricing;
