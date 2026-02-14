import { CtaBand, PageHero } from "@/components/page";
import { Link } from "react-router-dom";
import PlanCardsSection from "@/components/sections/PlanCardsSection";
import FAQSection from "@/components/sections/FAQSection";
import QuoteWidgetSection from "@/components/sections/QuoteWidgetSection";
import AddressCheckerSection from "@/components/sections/AddressCheckerSection";
import Seo from "@/components/seo/Seo";
import { productSchema } from "@/seo/structuredData";

const Pricing = () => {
  return (
    <div className="flex flex-col gap-0">
      <Seo
        title="Pricing & Plans | No More Mosquitoes (Orange County)"
        description="Acreage-based mosquito & pest control pricing with 14/21/30/42-day options. Annual prepay and one-time application available."
        canonicalUrl="https://nomoremosquitoes.us/pricing"
        jsonLd={[productSchema]}
      />
      <PageHero
        variant="centered"
        eyebrow="Transparent Pricing"
        title="100% non-toxic, California-approved protection — tough on pests, safe for pets, and made with your family’s well-being in mind."
        description="Powerful protection that’s family‑ and pet‑safe—California‑approved, non‑toxic insecticides that eliminate mosquitoes while keeping your home protected."
        primaryCta={{ label: "Get My Quote", href: "#quote" }}
      >
        <p className="text-sm text-muted-foreground">
          <Link to="/safety" className="font-medium text-primary underline-offset-4 hover:underline">Learn more</Link>
        </p>
        <ul className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
          <li>• Pricing adjusts automatically for acreage changes</li>
          <li>• Annual prepay discount available on every tier</li>
          <li>• 100% re-service guarantee between visits</li>
        </ul>
        <img
          src="https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2Faa7545ec62e74376aa3a6851bb458990?format=webp&width=800"
          alt="United States flag"
          className="pointer-events-none select-none hidden md:block absolute left-0 sm:left-2 md:left-4 lg:left-6 xl:left-8 top-6 sm:top-8 md:top-10 lg:top-12 xl:top-14 -translate-x-6 md:-translate-x-8 lg:-translate-x-10 w-24 sm:w-28 md:w-36 lg:w-44 xl:w-52 opacity-90 rounded shadow-md"
        />
        <img
          src="https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F044b876fa399404ca8e3d2f1eb4fcbb5?format=webp&width=800"
          alt="California Republic flag"
          className="pointer-events-none select-none hidden md:block absolute right-0 sm:right-2 md:right-4 lg:right-6 xl:right-8 top-6 sm:top-8 md:top-10 lg:top-12 xl:top-14 translate-x-6 md:translate-x-8 lg:translate-x-10 h-16 sm:h-20 md:h-24 lg:h-28 xl:h-32 w-auto opacity-90 rounded shadow-md"
        />
      </PageHero>
      <section id="quote">
        <QuoteWidgetSection />
      </section>
      <AddressCheckerSection />
      <PlanCardsSection />
      <FAQSection ids={["pricing", "safety", "weather"]} searchable />
      <CtaBand title="Need a custom acreage walkthrough?" href="/schedule" ctaLabel="Schedule a walkthrough" description="Larger than two acres or have complex terrain?" />
    </div>
  );
};

export default Pricing;
