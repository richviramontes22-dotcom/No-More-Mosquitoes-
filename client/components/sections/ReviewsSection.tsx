import SectionHeading from "@/components/common/SectionHeading";
import { testimonials } from "@/data/site";
import { Star } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";

const ReviewsSection = () => {
  const { t } = useTranslation();
  
  return (
    <section className="bg-background py-24">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow={t("reviews.eyebrow")}
          title={t("reviews.reviewTitle")}
          description={t("reviews.reviewDesc")}
          centered
        />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {testimonials.map((testimonial) => (
            <blockquote
              key={testimonial.name}
              className="flex h-full flex-col justify-between rounded-[28px] border border-border/70 bg-card/90 p-6 shadow-soft"
            >
              <div className="flex items-center gap-1 text-secondary">
                {Array.from({ length: testimonial.rating }).map((_, index) => (
                  <Star key={index} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <p className="mt-4 text-sm text-muted-foreground">"{testimonial.body}"</p>
              <footer className="mt-6 text-sm font-semibold text-foreground">
                {testimonial.name}
                <span className="block text-xs font-normal uppercase tracking-[0.3em] text-muted-foreground">
                  {testimonial.location}
                </span>
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ReviewsSection;
