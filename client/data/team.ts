export type TeamMember = {
  name: string;
  role: string;
  bio: string;
  imageAlt: string;
};

export const leadershipTeam: TeamMember[] = [
  {
    name: "Richard Viramontes",
    role: "Founder & Lead Technician",
    bio: "Licensed structural pest control operator who personally trains every employee-based technician on California DPR compliance.",
    imageAlt: "Portrait of Richard Viramontes, founder of No More Mosquitoes",
  },
  {
    name: "Elijah Noble",
    role: "IT Director / Platform Engineer",
    bio: "Architects the customer platform, service portal, and digital infrastructure that powers every booking, route, and customer interaction.",
    imageAlt: "Portrait of Elijah Noble, IT Director and Platform Engineer",
  },
  {
    name: "Christina Nguyen",
    role: "Quality Control",
    bio: "Ensures every treatment meets our premium standards through post-service inspections, product calibration checks, and technician feedback.",
    imageAlt: "Portrait of Christina Nguyen, Quality Control",
  },
  {
    name: "Bobby Reynoso",
    role: "Field Technician",
    bio: "Delivers precision insecticide applications across Orange County properties, following strict California DPR safety protocols on every visit.",
    imageAlt: "Portrait of Bobby Reynoso, Field Technician",
  },
  {
    name: "Sandy Viramontes",
    role: "Account Representative",
    bio: "Manages client accounts, coordinates service scheduling, and ensures every homeowner receives personalized, attentive support.",
    imageAlt: "Portrait of Sandy Viramontes, Account Representative",
  },
  {
    name: "Brianna Miyake",
    role: "Operations & Customer Service",
    bio: "Oversees daily operations and serves as the primary point of contact for customer inquiries, scheduling coordination, and service follow-ups.",
    imageAlt: "Portrait of Brianna Miyake, Operations and Customer Service",
  },
];
