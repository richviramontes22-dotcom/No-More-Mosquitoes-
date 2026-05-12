export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  readingTimeMinutes: number;
};

export const blogPosts: BlogPost[] = [
  {
    slug: "spring-mosquito-prep-orange-county",
    title: "Spring mosquito prep for Orange County neighborhoods",
    excerpt: "Tackle standing water, adjust irrigation schedules, and prepare for peak mosquito season with tips from licensed technicians.",
    publishedAt: "2024-03-05",
    readingTimeMinutes: 6,
  },
  {
    slug: "what-to-expect-after-your-first-visit",
    title: "What to expect after your first No More Mosquitoes visit",
    excerpt: "From completion videos to maintenance tips, here’s how we keep your backyard ready for every gathering.",
    publishedAt: "2024-06-18",
    readingTimeMinutes: 5,
  },
  {
    slug: "tick-safety-guide-for-southern-california",
    title: "Tick safety guide for Southern California families",
    excerpt: "Identify high-risk zones, protect pets, and keep trails safe with our technician-backed checklist.",
    publishedAt: "2024-08-22",
    readingTimeMinutes: 7,
  },
];
