import { PageHero, CtaBand } from "@/components/page";
import Seo from "@/components/seo/Seo";

const Privacy = () => (
  <div className="flex flex-col gap-0">
    <Seo
      title="Privacy Policy | No More Mosquitoes"
      description="How No More Mosquitoes collects, uses, and protects your personal information."
      canonicalUrl="https://nomoremosquitoes.us/privacy"
    />
    <PageHero
      variant="centered"
      eyebrow="Legal"
      title="Privacy Policy"
      description="Last updated: January 1, 2025"
    />
    <section className="bg-background py-16 md:py-24">
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8 prose prose-sm sm:prose dark:prose-invert max-w-none">

        <h2>1. Information We Collect</h2>
        <p>We collect information you provide directly to us when you schedule service, create an account, or contact us. This includes your name, email address, phone number, service address, and payment information processed securely through Stripe.</p>
        <p>We also collect information automatically when you use our website, including IP address, browser type, pages visited, and referring URLs. This data is used solely to improve our service and is never sold to third parties.</p>

        <h2>2. How We Use Your Information</h2>
        <p>We use the information we collect to:</p>
        <ul>
          <li>Schedule and confirm pest control service appointments</li>
          <li>Process payments securely via Stripe</li>
          <li>Send appointment reminders and service confirmations via SMS and email</li>
          <li>Deliver HD completion videos and technician notes through your customer portal</li>
          <li>Respond to your questions and support requests</li>
          <li>Improve our service based on usage patterns</li>
          <li>Comply with legal obligations</li>
        </ul>

        <h2>3. Call and SMS Tracking</h2>
        <p>If you call or text our business number, calls may be recorded for quality assurance and training purposes. By contacting us, you consent to this recording. SMS reminders are sent only to customers who have provided their phone number for service scheduling. You may opt out of SMS notifications at any time by replying STOP or updating your preferences in your customer portal.</p>

        <h2>4. Property Data</h2>
        <p>To provide accurate pricing and scheduling, we collect your property address and may use publicly available GIS data to estimate lot acreage. This information is used exclusively for service planning and is never shared with third-party advertisers.</p>

        <h2>5. Payment Information</h2>
        <p>All payment transactions are processed by Stripe, Inc. We do not store your full credit card number on our servers. Stripe is PCI-DSS compliant. Your card details are encrypted and handled according to Stripe's privacy policy.</p>

        <h2>6. Data Sharing</h2>
        <p>We do not sell your personal information. We share data only with:</p>
        <ul>
          <li><strong>Stripe</strong> — for payment processing</li>
          <li><strong>Supabase</strong> — for secure database storage</li>
          <li><strong>Law enforcement</strong> — when required by applicable law or valid legal process</li>
        </ul>

        <h2>7. Data Retention</h2>
        <p>We retain your account and service history for up to 7 years to fulfill legal, tax, and warranty obligations. You may request deletion of your personal data at any time by emailing us at {" "}
          <a href="mailto:richard@nomoremosquitoes.us">richard@nomoremosquitoes.us</a>. Note that some data may be retained where required by law.
        </p>

        <h2>8. Your Rights</h2>
        <p>You have the right to access, correct, or delete your personal information. California residents have additional rights under the California Consumer Privacy Act (CCPA), including the right to know what data we collect and how it is used. To submit a data request, contact us at the email below.</p>

        <h2>9. Cookies and Analytics</h2>
        <p>Our website uses essential cookies to enable login sessions and site functionality. We may use analytics tools to understand how visitors use our site. These tools do not collect personally identifiable information without your consent.</p>

        <h2>10. Contact Us</h2>
        <p>For privacy questions or data requests, contact:</p>
        <p>
          No More Mosquitoes<br />
          Orange County, California<br />
          Email: <a href="mailto:richard@nomoremosquitoes.us">richard@nomoremosquitoes.us</a><br />
          Phone: <a href="tel:+19492976225">(949) 297-6225</a>
        </p>
      </div>
    </section>
    <CtaBand title="Questions about your data?" href="/contact" ctaLabel="Contact Us" />
  </div>
);

export default Privacy;
