export type PricingTier = {
  min: number;
  max: number;
  label: string;
  subscription: number | "custom";
  annual: number | "custom";
};

export const pricingTiers: PricingTier[] = [
  { min: 0.01, max: 0.13, label: ".01 - .13 acres", subscription: 95, annual: 999 },
  { min: 0.14, max: 0.2, label: ".14 - .20 acres", subscription: 110, annual: 1200 },
  { min: 0.21, max: 0.3, label: ".21 - .30 acres", subscription: 125, annual: 1350 },
  { min: 0.31, max: 0.4, label: ".31 - .40 acres", subscription: 135, annual: 1450 },
  { min: 0.41, max: 0.5, label: ".41 - .50 acres", subscription: 145, annual: 1600 },
  { min: 0.51, max: 0.6, label: ".51 - .60 acres", subscription: 165, annual: 1800 },
  { min: 0.61, max: 0.7, label: ".61 - .70 acres", subscription: 175, annual: 1900 },
  { min: 0.71, max: 0.8, label: ".71 - .80 acres", subscription: 195, annual: 2100 },
  { min: 0.81, max: 1.15, label: ".81 - 1.15 acres", subscription: 215, annual: 2300 },
  { min: 1.16, max: 1.29, label: "1.16 - 1.29 acres", subscription: 230, annual: 2500 },
  { min: 1.3, max: 1.5, label: "1.30 - 1.50 acres", subscription: 250, annual: 2700 },
  { min: 1.51, max: 2, label: "1.51 - 2.0 acres", subscription: 270, annual: 2900 },
  { min: 2.01, max: Infinity, label: "2+ acres", subscription: "custom", annual: "custom" },
];

export const frequencyOptions = [14, 21, 30, 42] as const;

export const storyMarkdown = `Our Story

How One Backyard Evening Sparked a Mission to Protect Yours

No More Mosquitoes began back in 2016, in the comfort of Grandma's backyard — or so we thought. What started as a relaxing evening quickly turned into a battlefield. Within minutes of stepping outside, we were being eaten alive by mosquitoes. Laughter turned to slaps as we armed ourselves with sprays, lit candles, and tried every gadget we could find. Before long, our conversation turned into the never-ending goodbye from Grandma's home.

Our time together was cut short, and those itchy bites were a reminder of a simple problem that deserved a better solution. We promised ourselves to find a safe and dependable way to protect our community from those relentless pests.

Years later, No More Mosquitoes was born with one simple mission: to protect your space and your peace of mind. We built NMM on the same values Grandma instilled in us — honesty, hard work, and dependability. When we say we'll protect your yard, we mean it. That's why we back every service with a 100% satisfaction guarantee. You can count on us to show up on time, deliver reliable results, and keep your home mosquito-free all season long.

From that backyard in 2016 to the homes we serve today, No More Mosquitoes has become a trusted name in pest control. Because for us, this isn't just about bugs — it's about keeping your family safe, your time outdoors enjoyable, and your trust well-earned.`;

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
  // General
  { category: "General", id: "what-services", question: "What services does No More Mosquitoes provide?", answer: "We specialize in professional mosquito control and general insect management for residential and commercial properties using safe, effective, and targeted treatments." },
  { category: "General", id: "service-areas", question: "What areas do you service?", answer: "We provide service throughout your local region. Contact us to confirm availability in your specific area." },
  { category: "General", id: "how-treatments-work", question: "How do your mosquito treatments work?", answer: "We apply advanced insecticides to key mosquito resting and breeding areas, targeting them at multiple life stages for maximum effectiveness." },
  { category: "General", id: "safety", question: "Are your treatments safe for families and pets?", answer: "Yes. We use products that are EPA-approved and applied with precision. Once dry, treated areas are safe for normal activity." },
  { category: "General", id: "treatment-time", question: "How long does a treatment take?", answer: "Most treatments take 15–30 minutes depending on property size." },
  { category: "General", id: "results-timing", question: "How quickly will I see results?", answer: "You'll typically notice a significant reduction in mosquito activity within 24–48 hours." },
  { category: "General", id: "home-during-service", question: "Do I need to be home during the service?", answer: "No. As long as we have access to the treatment areas, you do not need to be present." },
  { category: "General", id: "what-makes-different", question: "What makes No More Mosquitoes different?", answer: "We focus on premium service, precision application for guaranteed results—not just spraying, but strategic insect control." },
  { category: "General", id: "free-estimates", question: "Do you offer free estimates?", answer: "Yes, we provide free consultations and quotes." },
  { category: "General", id: "guarantee", question: "Do you guarantee your service?", answer: "Yes. We stand behind our work with a satisfaction guarantee." },
  // Mosquito-Specific
  { category: "Mosquito-Specific", id: "treatment-frequency", question: "How often should I get mosquito treatments?", answer: "Typically every 3–4 weeks for consistent protection during peak seasons." },
  { category: "Mosquito-Specific", id: "eliminate-all", question: "Do treatments eliminate all mosquitoes?", answer: "While no service can guarantee 100% elimination, we dramatically reduce mosquito populations to near-zero levels." },
  { category: "Mosquito-Specific", id: "what-attracts", question: "What attracts mosquitoes to my yard?", answer: "Standing water, shade, dense vegetation, and humidity all contribute to mosquito activity." },
  { category: "Mosquito-Specific", id: "standing-water", question: "Can you treat standing water?", answer: "Yes. We apply larvicides to prevent mosquitoes from breeding in water sources. Our mosquito fish program is also effective on mosquito larvae." },
  { category: "Mosquito-Specific", id: "rain-effect", question: "Will rain affect the treatment?", answer: "Once dry, treatments are designed to withstand normal weather conditions, including rain." },
  { category: "Mosquito-Specific", id: "one-time", question: "Do you offer one-time treatments?", answer: "Yes, ideal for events or immediate relief." },
  { category: "Mosquito-Specific", id: "seasonal-plans", question: "Do you offer seasonal plans?", answer: "Yes, we offer recurring service plans for ongoing protection." },
  { category: "Mosquito-Specific", id: "disease-prevention", question: "Are your treatments effective against mosquito-borne diseases?", answer: "Our services significantly reduce mosquito populations, lowering the risk of exposure." },
  { category: "Mosquito-Specific", id: "treatment-time-of-day", question: "What time of day do you treat?", answer: "We typically treat during times when mosquitoes are most active, often early morning or evening." },
  { category: "Mosquito-Specific", id: "severe-infestations", question: "Can you help with severe infestations?", answer: "Yes, we can implement more aggressive treatment plans for high-activity areas." },
  // Other Pest Control
  { category: "Other Pest Control", id: "other-insects", question: "Do you treat insects other than mosquitoes?", answer: "Yes. We also handle a range of common outdoor pests." },
  { category: "Other Pest Control", id: "insect-types", question: "What types of insects do you control?", answer: "Most outdoor insects. This includes flies, gnats, ants, cockroaches, crickets, and many other nuisance insects." },
  { category: "Other Pest Control", id: "indoor-control", question: "Do you offer indoor pest control?", answer: "Our primary focus is outdoor insect control, but ask about our referral program." },
  { category: "Other Pest Control", id: "eco-friendly", question: "Are your treatments environmentally friendly?", answer: "We prioritize responsible application methods and products that minimize environmental impact." },
  { category: "Other Pest Control", id: "beneficial-insects", question: "Will your service harm beneficial insects?", answer: "We apply treatments strategically to target pests while minimizing impact on beneficial species." },
  // Preparation & Aftercare
  { category: "Preparation & Aftercare", id: "prepare-treatment", question: "How should I prepare for my treatment?", answer: "We recommend clearing clutter and limiting pet access to yard areas." },
  { category: "Preparation & Aftercare", id: "cover-furniture", question: "Do I need to cover outdoor furniture?", answer: "Not typically required, but you may do so if preferred." },
  { category: "Preparation & Aftercare", id: "return-outside", question: "When can I return outside after treatment?", answer: "Once the product has dried, usually within 30–60 minutes." },
  { category: "Preparation & Aftercare", id: "water-after", question: "Should I water my yard after treatment?", answer: "Avoid watering immediately after service unless instructed otherwise." },
  { category: "Preparation & Aftercare", id: "improve-results", question: "How can I improve results between treatments?", answer: "Eliminate standing water and maintain yard cleanliness." },
  // Pricing & Plans
  { category: "Pricing & Plans", id: "pricing", question: "How much does your service cost?", answer: "Pricing depends on property size and service frequency. Contact us for a custom quote." },
  { category: "Pricing & Plans", id: "subscription-plans", question: "Do you offer subscription plans?", answer: "Yes, we offer recurring service packages for ongoing protection." },
  { category: "Pricing & Plans", id: "contracts", question: "Are there contracts required?", answer: "We offer no-contract services with flexible options." },
  { category: "Pricing & Plans", id: "discounts", question: "Do you offer discounts?", answer: "Ask about seasonal promotions or bundled services." },
  { category: "Pricing & Plans", id: "payment-methods", question: "What payment methods do you accept?", answer: "We accept most major payment methods for your convenience." },
  // Scheduling & Service
  { category: "Scheduling & Service", id: "schedule", question: "How do I schedule a service?", answer: "You can schedule directly through our website at nomoremosquitoes.us or contact us directly." },
  { category: "Scheduling & Service", id: "service-speed", question: "How soon can I get service?", answer: "We often offer fast scheduling, sometimes same or next day depending on availability." },
  { category: "Scheduling & Service", id: "reschedule", question: "Can I reschedule my appointment?", answer: "Yes, simply contact us in advance." },
  { category: "Scheduling & Service", id: "weather", question: "What happens if it rains on my service day?", answer: "We will reschedule if conditions are not suitable for effective treatment." },
  { category: "Scheduling & Service", id: "emergency", question: "Do you offer emergency services?", answer: "Yes, for urgent mosquito problems or special events." },
  // Business & Trust
  { category: "Business & Trust", id: "licensed-insured", question: "Are you licensed and insured?", answer: "Yes, we operate in compliance with all local and state regulations." },
  { category: "Business & Trust", id: "team-experience", question: "How experienced is your team?", answer: "Our technicians are trained in advanced application techniques and pest control strategies." },
  { category: "Business & Trust", id: "products", question: "What products do you use?", answer: "We use professional-grade, industry-approved insecticides." },
  { category: "Business & Trust", id: "commercial", question: "Is your service suitable for commercial properties?", answer: "Yes, we service businesses, event spaces, and large properties." },
  { category: "Business & Trust", id: "large-properties", question: "Can you handle large properties?", answer: "Absolutely. We scale our services based on property size and needs." },
  // Results & Expectations
  { category: "Results & Expectations", id: "reduction-level", question: "What level of mosquito reduction should I expect?", answer: "Most clients experience a dramatic decrease, often 80–95% reduction." },
  { category: "Results & Expectations", id: "return-prevention", question: "Will mosquitoes come back?", answer: "Without maintenance, mosquitoes can return. Recurring service plans provide the best long-term protection." },
  { category: "Results & Expectations", id: "ongoing-monitoring", question: "Do you provide ongoing monitoring?", answer: "Yes, with recurring services we continuously manage and adjust treatments." },
  { category: "Results & Expectations", id: "not-satisfied", question: "What if I'm not satisfied?", answer: "There's a reason they're called pests. Don't worry — we will re-treat and address the issue as part of our satisfaction guarantee." },
  { category: "Results & Expectations", id: "get-started", question: "How do I get started?", answer: "Visit nomoremosquitoes.us or contact us directly to schedule your first service.",
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
  // LA County
  "90001", "90210", "90703", "90802", "91301",
  // Riverside County
  "92501", "92503", "92504", "92506", "92507",
  // San Diego County
  "92101", "92102", "92103", "92104", "92105"
];

export const siteConfig = {
  phone: {
    display: "(949) 297-6225",
    link: "tel:+19492976225",
  },
  email: "richard@nomoremosquitoes.us",
  crispWebsiteId: import.meta.env.VITE_CRISP_WEBSITE_ID || "b883932b-4716-4cd7-a027-302730273027",
};
