import SectionHeading from "@/components/common/SectionHeading";
import { Link } from "react-router-dom";
import { Mail, PhoneCall } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/data/site";

const ContactSection = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  const schedulePath = user ? "/dashboard/appointments" : "/login";

  return (
    <section className="bg-background py-24">
      <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-[36px] border border-border/70 bg-card/90 p-10 text-center shadow-soft">
          <SectionHeading
            eyebrow={t("contact.getStarted")}
            title={t("contact.readyQuestion")}
            description={t("contact.callText")}
            centered
          />
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              asChild
              className="rounded-full px-6 py-3 h-auto shadow-brand"
            >
              <a href={siteConfig.phone.link}>
                <PhoneCall className="h-4 w-4" aria-hidden />
                {t("contact.callOrText")}{siteConfig.phone.display}
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              className="rounded-full px-6 py-3 h-auto"
            >
              <a href={`mailto:${siteConfig.email}`}>
                <Mail className="h-4 w-4" aria-hidden />
                {siteConfig.email}
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              className="rounded-full bg-primary/5 px-6 py-3 h-auto border-primary/30 text-primary hover:bg-primary/10"
            >
              <Link to={schedulePath}>
                {t("contact.bookOnline")}
              </Link>
            </Button>
          </div>
          <p className="mt-6 text-xs text-muted-foreground">
            {t("contact.afterBooking")}
          </p>
        </div>
      </div>
    </section>
  );
};

export default ContactSection;
