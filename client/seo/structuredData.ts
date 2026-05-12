export const localBusinessSchema = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "No More Mosquitoes",
  image: "https://nomoremosquitoes.us/og-image.jpg",
  url: "https://nomoremosquitoes.us",
  telephone: "+1-949-297-6225",
  email: "richard@nomoremosquitoes.us",
  address: {
    "@type": "PostalAddress",
    streetAddress: "532 N. Magnolia Ave. Ste 212",
    addressLocality: "Anaheim",
    addressRegion: "CA",
    postalCode: "92801",
    addressCountry: "US",
  },
  areaServed: [
    { "@type": "AdministrativeArea", name: "Los Angeles County, CA" },
    { "@type": "AdministrativeArea", name: "Orange County, CA" },
    { "@type": "AdministrativeArea", name: "Riverside County, CA" },
    { "@type": "AdministrativeArea", name: "San Diego County, CA" }
  ],
  priceRange: "$$",
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ],
      opens: "07:00",
      closes: "19:00",
    },
  ],
  sameAs: [
    "https://www.instagram.com/nomoremosquitoes",
    "https://www.facebook.com/nomoremosquitoes",
  ],
};

export const serviceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Insect Control Services",
  serviceType: "Insect Control",
  provider: {
    "@type": "LocalBusiness",
    name: "No More Mosquitoes",
  },
  areaServed: [
    { "@type": "AdministrativeArea", name: "Los Angeles County, CA" },
    { "@type": "AdministrativeArea", name: "Orange County, CA" },
    { "@type": "AdministrativeArea", name: "Riverside County, CA" },
    { "@type": "AdministrativeArea", name: "San Diego County, CA" }
  ],
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Residential Pest Control Programs",
    itemListElement: [
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Product",
          name: "Mosquito Subscription Program",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Product",
          name: "Annual Mosquito & Pest Protection",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Product",
          name: "One-Time Mosquito Knockdown",
        },
      },
    ],
  },
};

export const productSchema = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "No More Mosquitoes Subscription",
  description:
    "Premium-friendly mosquito and pest control subscription with 14/21/30/42-day options, HD completion videos, and a re-service guarantee for Orange County homes.",
  brand: {
    "@type": "Brand",
    name: "No More Mosquitoes",
  },
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "USD",
    lowPrice: "80",
    highPrice: "249",
    offerCount: "12",
    availability: "https://schema.org/InStock",
  },
};

export const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "No More Mosquitoes",
  url: "https://nomoremosquitoes.us",
  logo: "https://nomoremosquitoes.us/og-image.jpg",
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "Customer Service",
    telephone: "+1-949-297-6225",
    email: "richard@nomoremosquitoes.us",
    areaServed: ["Los Angeles County, CA", "Orange County, CA", "Riverside County, CA", "San Diego County, CA"],
  },
  sameAs: [
    "https://www.instagram.com/nomoremosquitoes",
    "https://www.facebook.com/nomoremosquitoes",
  ],
};

export const createAggregateRatingSchema = (ratingValue: number, reviewCount: number) => ({
  "@context": "https://schema.org",
  "@type": "AggregateRating",
  itemReviewed: {
    "@type": "Service",
    name: "No More Mosquitoes Insect Control Services",
  },
  ratingValue: ratingValue.toFixed(1),
  reviewCount,
  bestRating: "5",
  worstRating: "1",
});

export const createFaqSchema = (
  qa: Array<{
    question: string;
    answer: string;
  }>,
) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: qa.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
});
