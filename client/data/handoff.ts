export const handoffChecklist = {
  infrastructure: [
    "Point DNS A/CNAME records to hosting provider (Vercel or Netlify) and confirm SSL certificates are active.",
    "Verify www → apex redirects and HTTPS enforcement.",
    "Enable daily backups or deployment rollbacks in hosting dashboard.",
  ],
  analytics: [
    "Create GA4 property, enable Consent Mode, and inject measurement ID once keys are available.",
    "Verify Google Search Console ownership and submit sitemap once live.",
    "Configure call tracking numbers and update CONTACT_PHONE_LINK if needed.",
  ],
  content: [
    "Populate Builder.io CMS models for sections, pricing tiers, testimonials, and FAQs if using the CMS flow.",
    "Upload HD completion videos and link to customer portal before launch.",
    "Review copy for location-specific compliance and licensing statements.",
  ],
  qa: [
    "Run Lighthouse audits (mobile + desktop) ensuring performance and accessibility scores ≥ 90.",
    "Validate pricing logic with acreage boundary tests (see client/lib/pricing.spec.ts).",
    "Cross-browser test on latest Chrome, Safari, Firefox, and mobile Safari/Chrome.",
  ],
  support: [
    "Confirm support escalation path and response times for call/text/email (Mon–Sat 7a–7p).",
    "Prepare launch-day email/SMS templates for existing customers.",
  ],
};
