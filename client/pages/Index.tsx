import HeroSection from "@/components/sections/HeroSection";
import QualityAssuranceSection from "@/components/sections/QualityAssuranceSection";
import PlanCardsSection from "@/components/sections/PlanCardsSection";
import VideoProofSection from "@/components/sections/VideoProofSection";
import StorySection from "@/components/sections/StorySection";
import FAQSection from "@/components/sections/FAQSection";
import ScheduleSection from "@/components/sections/ScheduleSection";
import ContactSection from "@/components/sections/ContactSection";
import PestGridSection from "@/components/sections/PestGridSection";
import CtaBand from "@/components/page/CtaBand";
import Seo from "@/components/seo/Seo";
import { localBusinessSchema, productSchema, serviceSchema } from "@/seo/structuredData";
import { useTranslation } from "@/hooks/use-translation";

const Index = () => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-0">
      <Seo
        title="Mosquito & Pest Control for Orange County"
        description="Premium-friendly mosquito and pest control in California with acreage-based pricing, 14/21/30/42-day cadences, and HD completion videos."
        canonicalUrl="https://nomoremosquitoes.us/"
        jsonLd={[localBusinessSchema, serviceSchema, productSchema]}
      />
      <HeroSection />
      <QualityAssuranceSection />
      <PlanCardsSection />
      <PestGridSection />
      <VideoProofSection />
      <CtaBand title={t("hero.checkPricing")} href="/pricing" />
      <StorySection />
      <FAQSection />
      <ScheduleSection />
      <ContactSection />
    </div>
  );
};

export default Index;
