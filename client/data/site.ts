export type PricingTier = {
  min: number;
  max: number;
  label: string;
  subscription: number | "custom";
  annual: number | "custom";
};

export const pricingTiers: PricingTier[] = [
  { min: 0.01, max: 0.13, label: ".01 - .13 acres", subscription: 80, annual: 1360 },
  { min: 0.14, max: 0.2, label: ".14 - .20 acres", subscription: 100, annual: 1700 },
  { min: 0.21, max: 0.3, label: ".21 - .30 acres", subscription: 110, annual: 1870 },
  { min: 0.31, max: 0.4, label: ".31 - .40 acres", subscription: 119, annual: 2023 },
  { min: 0.41, max: 0.5, label: ".41 - .50 acres", subscription: 129, annual: 2193 },
  { min: 0.51, max: 0.6, label: ".51 - .60 acres", subscription: 149, annual: 2533 },
  { min: 0.61, max: 0.7, label: ".61 - .70 acres", subscription: 159, annual: 2703 },
  { min: 0.71, max: 0.9, label: ".71 - .90 acres", subscription: 179, annual: 3043 },
  { min: 0.91, max: 1.15, label: ".91 - 1.15 acres", subscription: 195, annual: 3315 },
  { min: 1.18, max: 1.29, label: "1.18 - 1.29 acres", subscription: 209, annual: 3553 },
  { min: 1.3, max: 1.5, label: "1.30 - 1.5 acres", subscription: 229, annual: 3893 },
  { min: 1.51, max: 2, label: "1.51 - 2.0 acres", subscription: 249, annual: 4233 },
  { min: 2.01, max: Infinity, label: "2+ acres", subscription: "custom", annual: "custom" },
];

export const frequencyOptions = [14, 21, 30, 42] as const;

export const storyMarkdown = `Our Story

How One Backyard Evening Sparked a Mission to Protect Yours

No More Mosquitoes began back in 2016, in the comfort of Grandma’s backyard — or so we thought. What started as a relaxing evening quickly turned into a battlefield. Within minutes of stepping outside, we were being eaten alive by mosquitoes. Laughter turned to slaps as we armed ourselves with sprays, lit candles, and tried every gadget we could find. Before long, our conversation turned into the never-ending goodbye from Grandma’s home.

Our time together was cut short, and those itchy bites were a reminder of a simple problem that deserved a better solution. We promised ourselves to find a safe and dependable way to protect our community from those relentless pests.

Years later, No More Mosquitoes was born with one simple mission: to protect your space and your peace of mind. We built NMM on the same values Grandma instilled in us — honesty, hard work, and dependability. When we say we’ll protect your yard, we mean it. That’s why we back every service with a 100% satisfaction guarantee. You can count on us to show up on time, deliver reliable results, and keep your home mosquito-free all season long.

From that backyard in 2016 to the homes we serve today, No More Mosquitoes has become a trusted name in pest control. Because for us, this isn’t just about bugs — it’s about keeping your family safe, your time outdoors enjoyable, and your trust well-earned.`;

export const heroHighlights = [
  {
    label: "Complimentary completion video",
    value: "Every visit",
  },
  {
    label: "Re-service promise",
    value: "Same-week",
  },
  {
    label: "Family-safe formulations",
    value: "CA approved",
  },
];

export const pests = [
  "Mosquitoes",
  "Ticks (Brown dog & Deer)",
  "Ants (carpenter & Argentine)",
  "Spiders",
  "Roaches",
  "Armyworms",
  "Sod webworms",
  "Fleas",
];

export const benefits = [
  {
    title: "Licensed & insured technicians",
    description:
      "Employee-based professionals trained on WSDA and California structural pest compliance. We never outsource treatments.",
  },
  {
    title: "Safety-forward formulas",
    description:
      "Low-odor, CA-approved products applied precisely where families and pets spend time the most.",
  },
  {
    title: "Weather-adjusted scheduling",
    description:
      "Smart alerts reschedule around wind and rain so your treatment works the first time.",
  },
  {
    title: "Transparent reporting",
    description:
      "You receive HD video proof, technician notes, and prevention tips within minutes of completion.",
  },
];

export const services = [
  {
    name: "Mosquito perimeter treatment",
    description:
      "Backyard barrier spray neutralizes adult populations and breeding zones within minutes while protecting pollinators.",
  },
  {
    name: "Larvicide & standing water control",
    description:
      "Targeted larvicide treatments and drain maintenance stop egg cycles before they hatch.",
  },
  {
    name: "Tick & flea defense",
    description:
      "Yard and perimeter applications keep pets and kids protected between visits.",
  },
  {
    name: "Spider & ant perimeter",
    description:
      "Foundation crack sealing and precision sprays block pest entry into living spaces.",
  },
  {
    name: "Special event mosquito fogging",
    description:
      "Pre-event knockdown service ensures weddings, parties, and pool gatherings stay comfortable.",
  },
  {
    name: "Commercial pest programs",
    description:
      "Custom service cadences for HOA pools, resorts, and hospitality with documented compliance records.",
  },
];

export const testimonials = [
  {
    name: "Sarah L.",
    location: "Newport Beach",
    rating: 5,
    body: "We hosted my son’s graduation in the backyard with zero swatting. The completion video and notes make it so easy to trust the process.",
  },
  {
    name: "Ken and Priya R.",
    location: "Irvine",
    rating: 5,
    body: "Appointments are always on time, and the technicians explain exactly what they treat. The portal shows videos before we get home.",
  },
  {
    name: "Emily F.",
    location: "Costa Mesa",
    rating: 5,
    body: "Our toddler can play outside again. We love the reminders when weather changes. Worth every penny.",
  },
  {
    name: "Dominic P.",
    location: "Laguna Niguel",
    rating: 5,
    body: "They treated our slope and pool deck during peak season, and we still haven’t had to cancel a single barbecue night.",
  },
  {
    name: "Nora K.",
    location: "Mission Viejo",
    rating: 5,
    body: "Technicians are so respectful of our landscaping. The video walkthrough highlights every area they covered.",
  },
  {
    name: "Liam and Harper D.",
    location: "Huntington Beach",
    rating: 5,
    body: "Beachside winds used to make treatments tricky, but their weather adjustments keep our patio comfortable all summer.",
  },
];

export const faqs = [
  {
    id: "safety",
    question: "Is the treatment safe for kids and pets?",
    answer:
      "Yes. We use California-approved formulations applied in precise zones. Surfaces are dry within 30 minutes, and we send a completion video confirming coverage.",
  },
  {
    id: "pricing",
    question: "How do you calculate pricing for different lot sizes?",
    answer:
      "We price by acreage using precise GIS measurements. Subscription pricing reflects the time and product required for your lot size, while annual prepay and one-time options are available for flexible scheduling.",
  },
  {
    id: "weather",
    question: "What happens if it rains after my service?",
    answer:
      "Our routing software tracks humidity, wind, and rainfall. If weather may reduce effectiveness, we proactively reschedule or return for a no-cost touch-up.",
  },
  {
    id: "services",
    question: "Do you treat more than mosquitoes?",
    answer:
      "Absolutely. Every subscription covers mosquitoes, ticks, ants, spiders, earwigs, fleas, roaches, and seasonal lawn pests like armyworms and sod webworms.",
  },
  {
    id: "schedule",
    question: "How far in advance should I book a visit?",
    answer:
      "Peak season routes fill quickly, so booking 7–10 days in advance is ideal. For special events, we recommend reserving your date at least two weeks ahead.",
  },
  {
    id: "products",
    question: "What products do you use, and are they eco-conscious?",
    answer:
      "We apply EPA and California DPR-approved formulations that target mosquitoes while protecting pollinators. Granular larvicides and botanically derived repellents are used where appropriate.",
  },
  {
    id: "portal",
    question: "How do I access past visit videos and invoices?",
    answer:
      "Log in through the customer portal to see HD completion videos, technician notes, invoices, and auto-pay settings. You can request a secure magic link any time from the login page.",
  },
  {
    id: "guarantee",
    question: "What does your satisfaction guarantee cover?",
    answer:
      "If mosquitoes return between scheduled visits, contact us within seven days and we will re-service at no charge. The guarantee also covers ants, spiders, and ticks included in your program.",
  },
];

export const videoProofs = [
  {
    jobId: "OC-4821",
    title: "Newport Coast Hillside",
    summary: "Steep terraced yard with coastal wind buffering.",
    url: "https://example.com/videos/oc-4821",
    duration: "02:13",
  },
  {
    jobId: "NB-2150",
    title: "Balboa Island Patio",
    summary: "High-traffic entertaining space needing quick dry time.",
    url: "https://example.com/videos/nb-2150",
    duration: "01:47",
  },
  {
    jobId: "IR-3740",
    title: "Great Park Craftsman",
    summary: "Shade-heavy yard with standing water monitoring.",
    url: "https://example.com/videos/ir-3740",
    duration: "02:56",
  },
];

export const scheduleSteps = [
  {
    step: "1",
    title: "Check address & acreage",
    description: "Confirm you’re inside the OC route map and capture automated lot estimates or manual entry.",
  },
  {
    step: "2",
    title: "Customize your cadence",
    description: "Choose 14/21/30/42-day programs and add-on pest priorities before checkout.",
  },
  {
    step: "3",
    title: "Lock in day & technician",
    description: "See real-time availability, pay securely, and receive your portal login with ETA tracking.",
  },
];

export const serviceAreaZipCodes = [
  "92602",
  "92603",
  "92618",
  "92620",
  "92625",
  "92626",
  "92627",
  "92657",
  "92660",
  "92661",
  "92663",
  "92694",
  "92708",
];
