import { services } from "@/data/site";
import SectionHeading from "@/components/common/SectionHeading";
import { ShieldCheck, SprayCan, Waves } from "lucide-react";

const serviceIcons = [ShieldCheck, SprayCan, Waves];

const ServicesSection = () => {
  return (
    <section className="relative overflow-hidden bg-muted/30 py-24">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/10 via-background to-secondary/10" aria-hidden />
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Services"
          title="Targeted treatments that eliminate mosquitoes and the pests that follow them in."
          description="Each service plan covers mosquitoes, ticks, ants, spiders, and seasonal lawn pests. Technicians tailor the application to your shade, landscaping, and microclimate."
          centered
        />
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {services.map((service, index) => {
            const Icon = serviceIcons[index % serviceIcons.length];
            return (
              <div
                key={service.name}
                className="group relative rounded-[28px] border border-border/60 bg-card/90 p-6 shadow-soft transition hover:-translate-y-1 hover:border-primary/50 hover:shadow-[0_24px_60px_-40px_rgba(12,72,91,0.6)]"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="h-6 w-6" aria-hidden />
                </span>
                <h3 className="mt-6 font-display text-xl font-semibold text-foreground">{service.name}</h3>
                <p className="mt-3 text-sm text-muted-foreground">{service.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ServicesSection;
