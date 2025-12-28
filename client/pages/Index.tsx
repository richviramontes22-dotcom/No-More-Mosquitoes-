import HeroSection from "@/components/sections/HeroSection";
import AddressCheckerSection from "@/components/sections/AddressCheckerSection";
import QualityAssuranceSection from "@/components/sections/QualityAssuranceSection";
import QuoteWidgetSection from "@/components/sections/QuoteWidgetSection";
import PlanCardsSection from "@/components/sections/PlanCardsSection";
import BenefitsSection from "@/components/sections/BenefitsSection";
import ServicesSection from "@/components/sections/ServicesSection";
import VideoProofSection from "@/components/sections/VideoProofSection";
import ReviewsSection from "@/components/sections/ReviewsSection";
import StorySection from "@/components/sections/StorySection";
import FAQSection from "@/components/sections/FAQSection";
import ScheduleSection from "@/components/sections/ScheduleSection";
import ContactSection from "@/components/sections/ContactSection";
import PestGridSection from "@/components/sections/PestGridSection";
import Seo from "@/components/seo/Seo";
import { localBusinessSchema, productSchema, serviceSchema } from "@/seo/structuredData";

const Index = () => {
  return (
    <div className="flex flex-col gap-0">
      <Seo
        title="Mosquito & Pest Control for Orange County"
        description="Premium-friendly mosquito and pest control in Orange County with acreage-based pricing, 14/21/30/42-day cadences, and HD completion videos."
        canonicalUrl="https://nomoremosquitoes.us/"
        jsonLd={[localBusinessSchema, serviceSchema, productSchema]}
      />
      <HeroSection />
      <QualityAssuranceSection />
      <AddressCheckerSection />
      <QuoteWidgetSection />
      <PlanCardsSection />
      <BenefitsSection />
      <ServicesSection />
      <PestGridSection />
      <VideoProofSection />
      <ReviewsSection />
      <StorySection />
      <FAQSection />
      <ScheduleSection />
      <ContactSection />
    </div>
  );
};

export default Index;
