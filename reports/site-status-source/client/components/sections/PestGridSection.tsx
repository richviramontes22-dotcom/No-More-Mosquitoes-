import SectionHeading from "@/components/common/SectionHeading";
import { pests } from "@/data/site";
import { Bug } from "lucide-react";

const PestGridSection = () => {
  return (
    <section className="bg-muted/40 py-24">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Bugs we treat"
          title="More than mosquitoes: comprehensive pest defense for OC homes."
          description="Subscription programs cover the most common invaders we find across coastal and inland Orange County neighborhoods."
          centered
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {pests.map((pest) => (
            <div
              key={pest}
              className="flex items-center gap-3 rounded-2xl border border-border/50 bg-card/80 px-4 py-3 text-sm font-semibold text-muted-foreground shadow-soft"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Bug className="h-4 w-4" aria-hidden />
              </span>
              {pest}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PestGridSection;
