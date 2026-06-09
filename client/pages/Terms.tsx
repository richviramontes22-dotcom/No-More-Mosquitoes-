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

        <h2>3. Access to Property &amp; Technician Entry</h2>
        <p>You agree to provide safe and reasonable access to all areas of your property requiring treatment, including side yards, backyards, and any gate-locked areas. Gates must be unlocked or a code/key provided in advance through your customer portal.</p>
        <p>Our technicians are licensed, background-checked, and will always identify themselves before entering any gated area. Technicians will not enter your home. If access is not available at the scheduled time and we cannot reach you within 10 minutes of arrival, the appointment may be marked as a failed access and a trip charge of up to $25 may apply.</p>
        <p>Dogs and other pets must be secured or indoors during treatment. Children should be kept indoors during application and for 2 hours following. Treated areas should not be disturbed (watered, blown, or brushed) for 4 hours after application to preserve product effectiveness.</p>

        <h2>4. Pricing and Payment</h2>
        <p>Pricing is based on your property's acreage, service cadence, and selected program. Prices are quoted before service begins. Subscription services are billed recurring via Stripe on your chosen cadence (14, 21, 30, or 42 days). Annual prepay customers receive a discounted rate billed once at the start of the season.</p>
        <p>All prices are in USD. Prices may change with 30 days written notice for subscription customers.</p>

        <h2>5. Cancellations and Refund Policy</h2>
        <p>You may cancel your subscription at any time through your customer portal or by contacting us. Cancellations take effect at the end of your current billing period — you will continue to receive service through the end of the period you have already paid for.</p>
        <p><strong>3-day right to cancel:</strong> If you cancel within 3 business days of your initial subscription purchase and no service has been rendered, you are entitled to a full refund. This right is provided in accordance with California Business and Professions Code § 7159.</p>
        <p><strong>Service already rendered:</strong> If a service visit has already occurred, the charge for that visit is non-refundable. Remaining prepaid service periods will be prorated and refunded upon written request within 14 days of cancellation.</p>
        <p><strong>Annual prepay plans:</strong> Annual plans are non-refundable after the first service visit, except where required by California law. If no service has been rendered, a full refund may be requested within 10 business days of purchase.</p>
        <p>To request a refund, contact us at <a href="mailto:richard@nomoremosquitoes.us">richard@nomoremosquitoes.us</a> or call <a href="tel:+19492976225">(949) 297-6225</a>. Refunds are processed within 5–10 business days to your original payment method.</p>

        <h2>6. Service Satisfaction Guarantee</h2>
        <p>We stand behind every treatment. If pest activity returns between scheduled visits and you notify us within 7 days of your last treatment, we will re-service your property at no additional charge. This re-service guarantee is included with all active subscription plans.</p>
        <p><strong>How to request a re-service:</strong> Contact us by phone or email with your address and a brief description of the activity. We will schedule a follow-up visit within 5 business days.</p>
        <p><strong>Guarantee exclusions:</strong> The re-service guarantee does not apply if (a) access to the property was denied at the original visit, (b) treated areas were disturbed (watered, blown, or swept) within 4 hours of application, (c) the recurrence is due to a new infestation originating outside our treated zones, or (d) the subscription is not current (past-due or canceled).</p>
        <p>One-time service visits include a 72-hour callback window — if pest activity persists within 72 hours of treatment, we will return at no charge.</p>

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
