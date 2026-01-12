import SectionHeading from "@/components/common/SectionHeading";
import { benefits } from "@/data/site";
import { CheckCircle2 } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";

const BenefitsSection = () => {
  const { t } = useTranslation();
  
  return (
    <section className="bg-background py-24">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow={t("benefits.whyChooseUs")}
          title={t("benefits.whyChooseUsTitle")}
          description={t("benefits.whyChooseUsDesc")}
        />
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {benefits.map((benefit) => (
            <div
              key={benefit.title}
              className="flex gap-4 rounded-[28px] border border-border/70 bg-card/90 p-6 shadow-soft"
            >
              <span className="mt-1 flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <CheckCircle2 className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h3 className="text-lg font-semibold text-foreground">{benefit.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{benefit.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BenefitsSection;
