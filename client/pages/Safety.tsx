import { Link } from "react-router-dom";
import { CheckCircle2, Shield, Leaf, Users } from "lucide-react";
import { CtaBand, PageHero } from "@/components/page";
import SectionHeading from "@/components/common/SectionHeading";
import Seo from "@/components/seo/Seo";

const safetySchema = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "No More Mosquitoes",
  url: "https://nomoremosquitoes.us/safety",
  description: "Learn about our California-approved, non-toxic pest control safety standards and protocols.",
};

const Safety = () => {
  return (
    <div className="flex flex-col gap-0">
      <Seo
        title="Safety Standards | No More Mosquitoes"
        description="California-approved, non-toxic pest control formulations. Learn about our safety protocols protecting families, pets, and the environment."
        canonicalUrl="https://nomoremosquitoes.us/safety"
        jsonLd={[safetySchema]}
      />
      <PageHero
        variant="centered"
        title="Safety Standards"
        description="California-approved formulations and protocols that protect your family, pets, and environment."
        primaryCta={{ label: "Schedule a Service", href: "/schedule" }}
        secondaryCta={{ label: "View Pricing", href: "/pricing" }}
      />

      {/* Safety Certifications */}
      <section className="bg-background py-24">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 md:grid-cols-2">
            {[
              {
                icon: Shield,
                title: "California Licensed",
                description:
                  "All technicians hold current California Department of Pesticide Regulation (DPR) licenses. We maintain strict compliance with all state regulations for structural pest control.",
              },
              {
                icon: Leaf,
                title: "Non-Toxic Formulations",
                description:
                  "We use EPA-approved, low-toxicity treatments designed to eliminate pests while being safe for children, pets, and plants when applied according to label instructions.",
              },
              {
                icon: Users,
                title: "Family-Friendly Approach",
                description:
                  "Our treatment protocols are designed with your family in mind. We provide clear pre-treatment instructions and post-treatment safety information for every service visit.",
              },
              {
                icon: CheckCircle2,
                title: "Insurance Protected",
                description:
                  "We carry comprehensive liability insurance and workers' compensation coverage. Certificates available upon request for your peace of mind.",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="rounded-[28px] border border-border/60 bg-card/90 p-8 shadow-soft"
                >
                  <Icon className="h-12 w-12 text-primary" />
                  <h3 className="mt-4 font-display text-xl text-foreground">{item.title}</h3>
                  <p className="mt-3 text-sm text-muted-foreground">{item.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Detailed Safety Information */}
      <section className="bg-muted/50 py-24">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Safety Details"
            title="How We Keep Your Home Safe"
            description="Our treatment methods are designed with safety as the primary concern."
          />

          <div className="mt-12 space-y-12">
            {[
              {
                title: "Pre-Treatment Consultation",
                content:
                  "Before any service, we discuss your specific needs, any health concerns, and pet considerations. This allows us to customize our approach for your household. We'll explain what products we're using and how they work.",
              },
              {
                title: "Product Safety Information",
                content:
                  "All treatments we use are listed with the EPA and California DPR. We use the lowest effective concentrations to eliminate pests while minimizing any potential impact. Material Safety Data Sheets (MSDS) are available for all products upon request.",
              },
              {
                title: "Application Methods",
                content:
                  "We strategically apply treatments to areas where mosquitoes and pests rest and breed. This targeted approach reduces the amount of product needed and keeps treatments away from living spaces and children's areas.",
              },
              {
                title: "Post-Treatment Guidelines",
                content:
                  "After treatment, we provide clear instructions on re-entry, pet safety, and how long to avoid treated areas. Most treatments allow normal activity within 2-4 hours once dry. We recommend keeping pets and children indoors during application and for 2-3 hours afterward.",
              },
              {
                title: "Environmental Responsibility",
                content:
                  "Our product selection prioritizes minimal environmental impact. We avoid treatments that harm beneficial insects and focus on solutions that target specific pest problems without harming the broader ecosystem.",
              },
              {
                title: "Seasonal Safety Adjustments",
                content:
                  "We adjust our treatment schedules and methods based on seasonal factors. This includes timing applications appropriately and considering weather conditions to ensure maximum safety and effectiveness.",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-[28px] border border-border/60 bg-background p-8">
                <h3 className="font-display text-2xl text-foreground">{item.title}</h3>
                <p className="mt-4 text-muted-foreground">{item.content}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Specific Safety Standards */}
      <section className="bg-background py-24">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Compliance"
            title="Our Safety Standards & Certifications"
            description="We meet and exceed industry safety requirements."
          />

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              {
                label: "California DPR",
                detail: "Registered Pest Control Operator license in good standing",
              },
              {
                label: "EPA Compliance",
                detail: "All products registered and approved by the Environmental Protection Agency",
              },
              {
                label: "NPMA Standards",
                detail: "Members adhere to National Pest Management Association best practices",
              },
              {
                label: "Liability Insurance",
                detail: "$1M+ general liability coverage for your protection",
              },
              {
                label: "Continuing Education",
                detail: "Technicians maintain certifications through annual continuing education",
              },
              {
                label: "Quality Assurance",
                detail: "Regular training and service audits ensure consistent safety protocols",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-[28px] border border-primary/20 bg-primary/5 p-6"
              >
                <p className="font-semibold text-primary">{item.label}</p>
                <p className="mt-2 text-sm text-muted-foreground">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pet & Child Safety */}
      <section className="bg-muted/50 py-24">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Family Safety"
            title="Safety for Pets and Children"
            description="Your family is our priority. Here's how we keep them safe during treatment."
          />

          <div className="mt-12 grid gap-8 md:grid-cols-2">
            <div className="rounded-[28px] border border-border/60 bg-background p-8">
              <h3 className="font-display text-2xl text-foreground">During Treatment</h3>
              <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-3">
                  <span className="mt-1 flex-shrink-0">✓</span>
                  <span>Keep children and pets indoors during application</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 flex-shrink-0">✓</span>
                  <span>Close windows and doors in treated areas</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 flex-shrink-0">✓</span>
                  <span>Remove pet food and water bowls from treated zones</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 flex-shrink-0">✓</span>
                  <span>Our technicians will clearly mark treated areas</span>
                </li>
              </ul>
            </div>

            <div className="rounded-[28px] border border-border/60 bg-background p-8">
              <h3 className="font-display text-2xl text-foreground">After Treatment</h3>
              <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-3">
                  <span className="mt-1 flex-shrink-0">✓</span>
                  <span>Wait 2-4 hours before re-entering treated areas</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 flex-shrink-0">✓</span>
                  <span>Ventilate the area with open windows</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 flex-shrink-0">✓</span>
                  <span>Wash hands and exposed skin with soap and water</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 flex-shrink-0">✓</span>
                  <span>Return pet food and water bowls to normal areas</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-background py-24">
        <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Common Questions"
            title="Safety FAQs"
            description="We're happy to answer any questions about our safety practices."
          />

          <div className="mt-12 space-y-6">
            {[
              {
                q: "Are your treatments safe for babies and infants?",
                a: "Yes. Our treatments are applied to areas where mosquitoes rest, not in living spaces. Following our pre and post-treatment guidelines, your home is safe for infants and small children.",
              },
              {
                q: "What about pregnant women?",
                a: "Our formulations are safe for pregnant women when applied according to label instructions. If you have specific health concerns, please let us know during your consultation.",
              },
              {
                q: "Can I use my backyard immediately after treatment?",
                a: "Most areas are safe to use after 2-4 hours once the treatment has dried. We'll provide specific guidance based on the products used and weather conditions.",
              },
              {
                q: "What if someone in my household has chemical sensitivities?",
                a: "Please notify us before your appointment. We can discuss alternative treatment methods and may be able to customize our approach for your household.",
              },
              {
                q: "Do you guarantee that treatments won't harm my garden or plants?",
                a: "Our treatments target pests without harming desirable plants when applied correctly. We'll discuss your garden during consultation and apply treatments accordingly.",
              },
            ].map((item, idx) => (
              <div key={idx} className="rounded-[20px] border border-border/60 bg-muted/40 p-6">
                <p className="font-semibold text-foreground">{item.q}</p>
                <p className="mt-3 text-sm text-muted-foreground">{item.a}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 rounded-[28px] border border-primary/20 bg-primary/5 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Have other safety questions?{" "}
              <Link to="/contact" className="font-semibold text-primary hover:text-primary/80">
                Contact us directly
              </Link>
              {" "}and we'll be happy to help.
            </p>
          </div>
        </div>
      </section>

      <CtaBand title="Ready to Schedule Your Service?" href="/schedule" />
    </div>
  );
};

export default Safety;
