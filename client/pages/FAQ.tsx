import { PageHero } from "@/components/page";
import FAQSection from "@/components/sections/FAQSection";
import Seo from "@/components/seo/Seo";
import { faqs } from "@/data/site";
import { createFaqSchema } from "@/seo/structuredData";

const FAQ = () => {
  return (
    <div className="flex flex-col gap-0">
      <Seo
        title="FAQ"
        description="Answers to common mosquito & pest control questions."
        canonicalUrl="https://nomoremosquitoes.us/faq"
        jsonLd={[createFaqSchema(faqs)]}
      />
      <PageHero
        variant="centered"
        title="Frequently Asked Questions"
        description="Safety, ingredients, visit timing, weather, and what to expect."
        primaryCta={{ label: "Schedule Service", href: "/schedule" }}
      />
      <FAQSection searchable />
    </div>
  );
};

export default FAQ;
