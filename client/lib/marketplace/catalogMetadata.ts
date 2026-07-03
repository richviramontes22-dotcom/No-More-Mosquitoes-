/**
 * Static enrichment for catalog items.
 * Provides descriptions, badges, and best-for tags when the DB fields are null.
 * DB values always take precedence — this is a display fallback only.
 */

export interface CatalogMeta {
  description: string;
  bestFor?: string;
  badge?: "recommended" | "popular" | "new" | "value" | "eco";
  category?: string;
  oneTimeCompatible?: boolean;
  recurringCompatible?: boolean;
}

const badgeLabels: Record<NonNullable<CatalogMeta["badge"]>, string> = {
  recommended: "Recommended",
  popular: "Most Popular",
  new: "New",
  value: "Great Value",
  eco: "Eco-Friendly",
};

export const getBadgeLabel = (badge: CatalogMeta["badge"]): string | undefined =>
  badge ? badgeLabels[badge] : undefined;

export const CATALOG_META: Record<string, CatalogMeta> = {
  "yard-sign-metal": {
    description:
      "Durable aluminum yard sign with metal stake. Lets your neighbors know you're protecting your outdoor space from mosquitoes.",
    bestFor: "Long-term outdoor display",
    badge: "popular",
    oneTimeCompatible: true,
    recurringCompatible: true,
  },
  "yard-sign-general": {
    description:
      "Corrugated plastic yard sign to show your neighbors you take mosquito control seriously. Lightweight and easy to place.",
    bestFor: "Quick outdoor display",
    badge: "value",
    oneTimeCompatible: true,
    recurringCompatible: true,
  },
  "garden-flag": {
    description:
      "Decorative garden flag to proudly display your No More Mosquitoes commitment. Adds a clean, professional look to your yard.",
    bestFor: "Garden and entryway display",
    oneTimeCompatible: true,
    recurringCompatible: true,
  },
  "mosquito-dunks": {
    description:
      "EPA-registered Bacillus thuringiensis dunks for standing water. Kills mosquito larvae before they hatch — safe for pets, birds, and wildlife.",
    bestFor: "Fountains, birdbaths, planters",
    badge: "eco",
    oneTimeCompatible: true,
    recurringCompatible: true,
  },
  "fly-trap-service": {
    description:
      "Add professional fly trap placement and monitoring to your next service visit. Targets house flies, fruit flies, and gnats in problem outdoor areas.",
    bestFor: "Patios, outdoor dining, trash areas",
    badge: "popular",
    oneTimeCompatible: true,
    recurringCompatible: true,
  },
  "spider-web-service": {
    description:
      "Add spider web removal to your next visit. Technicians clear webs from eaves, entry doors, fences, and high-traffic outdoor areas.",
    bestFor: "Entryways, patios, fences",
    oneTimeCompatible: true,
    recurringCompatible: true,
  },
  "gutter-cleaning": {
    description:
      "Clogged gutters are a top mosquito breeding site. Add a professional cleanout to eliminate standing water breeding zones at the source.",
    bestFor: "Homes with mature trees nearby",
    badge: "recommended",
    oneTimeCompatible: true,
    recurringCompatible: false,
  },
  "mosquito-fish-gambusia-affinis": {
    description:
      "Gambusia affinis are aggressive mosquito larva eaters, ideal for ornamental ponds and slow-moving water. Includes expert consultation and stocking guidance.",
    bestFor: "Ornamental ponds, irrigation ponds",
    badge: "recommended",
    oneTimeCompatible: true,
    recurringCompatible: false,
  },
  "mosquito-fish-koi": {
    description:
      "Koi are highly effective mosquito larvae consumers and add beauty to any water feature. Includes consultation on stocking density and pond compatibility.",
    bestFor: "Decorative koi ponds",
    oneTimeCompatible: true,
    recurringCompatible: false,
  },
  "mosquito-fish-guppy": {
    description:
      "Guppies thrive in warm, shallow water and consume large quantities of mosquito larvae. Ideal for small garden ponds and water containers.",
    bestFor: "Small ponds, water containers",
    oneTimeCompatible: true,
    recurringCompatible: false,
  },
  "mosquito-fish-goldfish": {
    description:
      "Goldfish readily consume mosquito larvae and are easy to maintain. A natural, chemical-free larvicide option for backyard ponds.",
    bestFor: "Backyard ponds, small water features",
    oneTimeCompatible: true,
    recurringCompatible: false,
  },
  "mosquito-fish-minnows": {
    description:
      "Native minnows are natural mosquito predators that thrive in local water conditions. Includes expert consultation on species selection and stocking rates.",
    bestFor: "Natural ponds, larger water features",
    badge: "eco",
    oneTimeCompatible: true,
    recurringCompatible: false,
  },
  "mosquito-fish-betta-fish": {
    description:
      "Betta fish are excellent mosquito larvivores for smaller water features and containers. Includes consultation on habitat and care requirements.",
    bestFor: "Small water features, containers",
    oneTimeCompatible: true,
    recurringCompatible: false,
  },
  "mosquito-fish-bluegill": {
    description:
      "Bluegill and sunfish are powerful mosquito larvae consumers for larger ponds and water bodies. Includes consultation on pond compatibility and stocking density.",
    bestFor: "Large ponds, retention ponds",
    oneTimeCompatible: true,
    recurringCompatible: false,
  },
};

export const getCatalogMeta = (slug: string): CatalogMeta | null =>
  CATALOG_META[slug] ?? null;
