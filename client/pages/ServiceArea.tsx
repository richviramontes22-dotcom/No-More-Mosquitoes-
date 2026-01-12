import { PageHero, WaitlistForm } from "@/components/page";
import SectionHeading from "@/components/common/SectionHeading";
import Seo from "@/components/seo/Seo";
import { serviceAreaZipCodes } from "@/data/site";

const cities = ["Newport Beach", "Irvine", "Costa Mesa", "Mission Viejo", "Laguna Niguel", "Huntington Beach"];

const placeSchema = {
  "@context": "https://schema.org",
  "@type": "Place",
  name: "No More Mosquitoes Service Area",
  description: "Orange County mosquito and pest control",
  areaServed: cities,
  hasMap: "https://maps.google.com/?q=Orange+County+CA",
};

const ServiceArea = () => {
  return (
    <div className="flex flex-col gap-0">
      <Seo
        title="Service Area | Orange County"
        description="See our OC service ZIPs and cities. Outside? Join the waitlist."
        canonicalUrl="https://nomoremosquitoes.us/service-area"
        jsonLd={[placeSchema]}
      />
      <PageHero
        variant="centered"
        title="Where we service"
        description="Orange County focus with expansion in progress. Join the waitlist if you’re outside the map."
        primaryCta={{ label: "Join the waitlist", href: "#waitlist" }}
      />
      <section className="bg-background py-24">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="ZIP coverage"
            title="Currently routing technicians across these ZIP codes."
            description="Route availability updates in real time. If you don’t see your ZIP yet, add yourself to the waitlist so we can expand faster."
          />
          <div className="mt-12 grid gap-3 sm:grid-cols-3">
            {serviceAreaZipCodes.map((zip) => (
              <span
                key={zip}
                className="flex items-center justify-center rounded-[20px] border border-border/60 bg-muted/50 px-4 py-3 text-sm font-semibold text-foreground"
              >
                {zip}
              </span>
            ))}
          </div>
        </div>
      </section>
      <section className="bg-muted/30 py-24">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Cities"
            title="Neighborhoods we treat every week."
            description="Our technicians focus on dense mosquito zones across coastal and inland OC."
          />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cities.map((city) => (
              <article
                key={city}
                className="rounded-[24px] border border-border/60 bg-card/90 p-6 shadow-soft"
              >
                <h3 className="font-display text-lg text-foreground">{city}</h3>
                <p className="mt-2 text-sm text-muted-foreground">Weekly routes available</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section id="waitlist" className="bg-background py-24">
        <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Outside the map?"
            title="Join the waitlist for new routes."
            description="We launch routes based on demand. Add your email and ZIP so we can notify you first."
            centered
          />
          <div className="mt-10">
            <WaitlistForm endpoint="/api/waitlist" />
          </div>
        </div>
      </section>
    </div>
  );
};

export default ServiceArea;
