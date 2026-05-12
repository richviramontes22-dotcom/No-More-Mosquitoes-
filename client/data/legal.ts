export type LegalSection = {
  heading: string;
  body: string[];
};

export const privacyPolicySections: LegalSection[] = [
  {
    heading: "How we collect information",
    body: [
      "We collect contact details, property information, and communication preferences that you provide when requesting a quote, joining the waitlist, or scheduling service.",
      "We capture visit metadata including technician notes, weather conditions, acreage estimates, and treatment history to fulfill your service and guarantee commitments.",
      "We receive limited analytics and advertising signals through consent-enabled platforms such as Google Analytics 4 and Google Search Console. These signals are anonymized and respect the consent settings you select on our site.",
    ],
  },
  {
    heading: "How we use information",
    body: [
      "We use your contact details to confirm appointments, send service reminders, deliver completion videos, and notify you about weather adjustments.",
      "Operational data powers route planning, product calibration, and quality inspections so we can back every visit with our re-service guarantee.",
      "If you grant consent, we use aggregated analytics to understand how visitors interact with our site and improve booking flows. We do not sell personal data or share it with third parties outside of core service delivery.",
    ],
  },
  {
    heading: "Data retention and security",
    body: [
      "Customer records are stored in encrypted systems that meet California data privacy requirements. We retain service history for as long as you remain an active or returning customer, or as required by licensing authorities.",
      "You may request a full data report or deletion at any time by emailing privacy@nomoremosquitoes.us. We verify every request before processing changes to protect your account.",
      "Technician tablets and field devices enforce passcodes, device encryption, and remote-wipe capabilities to safeguard sensitive property details.",
    ],
  },
  {
    heading: "Your privacy choices",
    body: [
      "Update your communication preferences directly in the customer portal or by contacting our support team.",
      "Use the consent banner on our site to toggle analytics, advertising, and functional cookies. Changes take effect immediately for future visits.",
      "California residents can exercise their CCPA rights by submitting a request through our contact form or by calling (949) 763-0492.",
    ],
  },
];

export const termsOfServiceSections: LegalSection[] = [
  {
    heading: "Scheduling and access",
    body: [
      "We service properties Monday through Saturday between 7 a.m. and 7 p.m. You will receive a confirmation window the day before your appointment.",
      "Ensure gates are unlocked and pets remain indoors during your visit. If we cannot access the treatment area, we will reschedule at the next available opening.",
    ],
  },
  {
    heading: "Service expectations",
    body: [
      "Every visit includes a perimeter barrier, standing water inspection, and targeted pest treatments outlined in your program.",
      "Completion videos, technician notes, and next-visit reminders are delivered within minutes of service so you know exactly what was treated.",
    ],
  },
  {
    heading: "Weather adjustments",
    body: [
      "We monitor wind, rain, and humidity daily. If conditions may reduce treatment effectiveness, we proactively adjust your appointment.",
      "If weather shifts unexpectedly after a visit, contact us within seven days and we will re-service at no additional cost.",
    ],
  },
  {
    heading: "Billing and guarantees",
    body: [
      "Subscription visits are billed after completion unless you prepay annually. One-time services require payment at booking.",
      "Our 100% satisfaction guarantee covers re-service for mosquitoes, ants, spiders, ticks, and fleas between scheduled visits.",
    ],
  },
];

export type GuaranteeStep = {
  title: string;
  description: string;
};

export const guaranteeSteps: GuaranteeStep[] = [
  {
    title: "Contact our support team",
    description: "Reach out by phone, text, or email within seven days of noticing increased mosquito activity.",
  },
  {
    title: "Schedule a priority re-service",
    description: "We confirm access details, review weather conditions, and dispatch your original technician whenever possible.",
  },
  {
    title: "Document the follow-up",
    description: "You receive an HD completion video, technician notes, and prevention recommendations after the re-service visit.",
  },
];

export type LicenseDocument = {
  label: string;
  href: string;
  description: string;
};

export const licenseDocuments: LicenseDocument[] = [
  {
    label: "CA Structural Pest Control License #PR 45678",
    href: "/docs/license.pdf",
    description: "Issued by the California Department of Pesticide Regulation; renews annually with continuing education.",
  },
  {
    label: "General Liability Insurance Certificate",
    href: "/docs/insurance.pdf",
    description: "$2M aggregate coverage for residential and light commercial pest control operations.",
  },
];
