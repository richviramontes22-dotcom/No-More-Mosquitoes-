import SectionHeading from "@/components/common/SectionHeading";
import { CtaBand, PageHero } from "@/components/page";
import PestGridSection from "@/components/sections/PestGridSection";
import VideoProofSection from "@/components/sections/VideoProofSection";
import Seo from "@/components/seo/Seo";
import { services as serviceCatalog } from "@/data/site";
import { serviceSchema } from "@/seo/structuredData";
import { useTranslation } from "@/hooks/use-translation";

const heroAside = (
  <div className="space-y-4">
    <p className="text-sm text-muted-foreground">
      Every visit includes calibrated applications, technician documentation, and an HD completion video delivered minutes after service.
    </p>
    <ul className="grid gap-3 text-sm text-foreground">
      <li className="rounded-2xl bg-background/80 px-4 py-3 shadow-soft">Employee-based technicians</li>
      <li className="rounded-2xl bg-background/80 px-4 py-3 shadow-soft">Pollinator-conscious formulations</li>
      <li className="rounded-2xl bg-background/80 px-4 py-3 shadow-soft">Weather-adjusted scheduling</li>
      <li className="rounded-2xl bg-background/80 px-4 py-3 shadow-soft">Completion video + technician notes</li>
    </ul>
  </div>
);

const addOnServices = [
  {
    name: "Ants (incl. carpenter & Argentine)",
    features: ["Exterior perimeter", "Entry-point treatment", "Baiting strategy"],
  },
  {
    name: "Spiders",
    features: ["Eaves & webs removal", "Crack & crevice treatment", "Dusting for hard-to-reach zones"],
  },
  {
    name: "Ticks",
    features: ["Yard perimeter", "High-risk zones treatment", "Pet relief focus"],
  },
];

const Services = () => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-0">
      <Seo
        title="Mosquito & Pest Control Services"
        description="Safe, fast, reliable mosquito treatment plus ants, spiders, and ticks—professionally serviced in Orange County."
        canonicalUrl="https://nomoremosquitoes.us/services"
        jsonLd={[serviceSchema]}
      />
      <PageHero
        variant="split"
        eyebrow={t("services.whatWeTreat")}
        title={t("services.servicePageTitle")}
        description={t("services.servicePageDesc")}
        primaryCta={{ label: t("hero.scheduleService"), href: "/schedule" }}
        aside={heroAside}
      />
      <section className="bg-background py-24">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Core treatments"
            title="Every mosquito visit includes these steps."
            description="Our technicians follow a proven protocol to knock down adult populations, disrupt breeding grounds, and harden your perimeter against re-entry."
          />
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {serviceCatalog.map((service) => (
              <article
                key={service.name}
                className="flex h-full flex-col justify-between rounded-[28px] border border-border/70 bg-card/90 p-6 shadow-soft"
              >
                <div>
                  <h3 className="font-display text-xl text-foreground">{service.name}</h3>
                  <p className="mt-3 text-sm text-muted-foreground">{service.description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="bg-muted/40 py-24">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Add-on defense"
            title="Layer in pest protection without juggling multiple vendors."
            description="Ants, spiders, and ticks receive the same precision treatments as mosquitoes—no surge pricing or surprise add-ons."
          />
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {addOnServices.map((service) => (
              <article
                key={service.name}
                className="rounded-[28px] border border-border/60 bg-background/90 p-6 shadow-soft"
              >
                <h3 className="font-display text-lg text-foreground">{service.name}</h3>
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  {service.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <span aria-hidden>•</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>
      <VideoProofSection />
      <PestGridSection />
      <CtaBand title={t("hero.checkPricing")} href="/pricing" />
    </div>
  );
};

export default Services;
