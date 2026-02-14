import { CtaBand, PageHero } from "@/components/page";
import ReviewsSection from "@/components/sections/ReviewsSection";
import Seo from "@/components/seo/Seo";
import { testimonials } from "@/data/site";
import { createAggregateRatingSchema, productSchema } from "@/seo/structuredData";

const ratingValue = 4.9;
const reviewCount = 128;

const Reviews = () => {
  return (
    <div className="flex flex-col gap-0">
      <Seo
        title="Customer Reviews"
        description="See reviews from Orange County homeowners about our mosquito & pest control."
        canonicalUrl="https://nomoremosquitoes.us/reviews"
        jsonLd={[productSchema, createAggregateRatingSchema(ratingValue, reviewCount)]}
      />
      <PageHero
        variant="centered"
        title="Loved by OC neighbors."
        description="Friendly techs, HD visit videos, and mosquito-free yards."
        primaryCta={{ label: "Schedule Service", href: "/schedule" }}
      >
        <p className="max-w-2xl text-sm text-muted-foreground">
          Our re-service guarantee, completion videos, and weather-adjusted scheduling earn five-star ratings across Orange County.
        </p>
      </PageHero>
      <ReviewsSection />
      <section className="bg-muted/30 py-16">
        <div className="mx-auto w-full max-w-4xl px-4 text-center">
          <p className="text-sm uppercase tracking-[0.4em] text-muted-foreground">Average rating</p>
          <p className="mt-4 font-display text-5xl text-foreground">{ratingValue.toFixed(1)} / 5.0</p>
          <p className="mt-2 text-sm text-muted-foreground">Based on {reviewCount}+ homeowner surveys and platform reviews.</p>
        </div>
      </section>
      <CtaBand title="Schedule Service" href="/schedule" />
    </div>
  );
};

export default Reviews;
