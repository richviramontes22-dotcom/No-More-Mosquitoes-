import { PageHero, CtaBand } from "@/components/page";
import Seo from "@/components/seo/Seo";

const Terms = () => (
  <div className="flex flex-col gap-0">
    <Seo
      title="Terms of Service | No More Mosquitoes"
      description="Terms governing pest control services, scheduling, cancellations, and our satisfaction guarantee."
      canonicalUrl="https://nomoremosquitoes.us/terms"
    />
    <PageHero
      variant="centered"
      eyebrow="Legal"
      title="Terms of Service"
      description="Last updated: January 1, 2025"
    />
    <section className="bg-background py-16 md:py-24">
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8 prose prose-sm sm:prose dark:prose-invert max-w-none">

        <h2>1. Services</h2>
        <p>No More Mosquitoes provides residential and commercial pest control services in Orange County, California. Services are performed by licensed, insured technicians using California Department of Pesticide Regulation (CDPR) approved formulations. Our Pest Control Business License number is 57621.</p>

        <h2>2. Scheduling and Appointments</h2>
        <p>Appointments are scheduled based on route availability. We will make every effort to arrive within your scheduled time window. Actual arrival times may vary due to weather, traffic, or extended service at prior stops. We will notify you of significant delays.</p>
        <p>Weather policy: If weather conditions (wind, rain, or extreme heat) would reduce treatment effectiveness, we reserve the right to reschedule your appointment at no charge. We monitor conditions actively and will proactively notify you of any changes.</p>

        <h2>3. Access to Property</h2>
        <p>You agree to provide safe and reasonable access to all areas of your property requiring treatment. Dogs and other pets must be secured or indoors during treatment. Children should be kept indoors during application and for 2 hours following. If access is not available at the scheduled time, a trip charge may apply.</p>

        <h2>4. Pricing and Payment</h2>
        <p>Pricing is based on your property's acreage, service cadence, and selected program. Prices are quoted before service begins. Subscription services are billed recurring via Stripe on your chosen cadence (14, 21, 30, or 42 days). Annual prepay customers receive a discounted rate billed once at the start of the season.</p>
        <p>All prices are in USD. Prices may change with 30 days written notice for subscription customers.</p>

        <h2>5. Cancellations and Refunds</h2>
        <p>You may cancel your subscription at any time through your customer portal or by contacting us. Cancellations take effect at the end of your current billing period. Annual prepay plans are non-refundable after service has begun, except where required by California law.</p>
        <p>If you cancel within 3 business days of subscribing and no service has been rendered, you are entitled to a full refund.</p>

        <h2>6. Satisfaction Guarantee</h2>
        <p>If pest activity returns between scheduled visits and you notify us within 7 days of your last treatment, we will re-service your property at no additional charge. The guarantee covers all pests included in your active program. The guarantee does not apply if access to the property is denied, treatment areas were disturbed within 48 hours, or if the recurrence is due to a new infestation originating outside our treated zones.</p>

        <h2>7. Chemicals and Safety</h2>
        <p>All products used are registered with the EPA and approved by the California Department of Pesticide Regulation. We use low-odor, targeted formulations. Technicians will provide a completion summary including all products applied. Material Safety Data Sheets (MSDS) are available upon request.</p>

        <h2>8. Limitation of Liability</h2>
        <p>No More Mosquitoes is not liable for pest activity beyond the scope of our service agreement, damage caused by pests after treatment, or conditions arising from failure to maintain the property between visits. Our total liability for any claim arising from services rendered is limited to the amount paid for the affected service period.</p>

        <h2>9. Governing Law</h2>
        <p>These terms are governed by the laws of the State of California. Any disputes shall be resolved in Orange County, California courts.</p>

        <h2>10. Contact</h2>
        <p>
          No More Mosquitoes<br />
          Orange County, California<br />
          Email: <a href="mailto:richard@nomoremosquitoes.us">richard@nomoremosquitoes.us</a><br />
          Phone: <a href="tel:+19492976225">(949) 297-6225</a>
        </p>
      </div>
    </section>
    <CtaBand title="Have questions about our terms?" href="/contact" ctaLabel="Contact Us" />
  </div>
);

export default Terms;
