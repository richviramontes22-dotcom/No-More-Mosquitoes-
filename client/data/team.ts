export type TeamMember = {
  name: string;
  role: string;
  bio: string;
  imageAlt: string;
};

export const leadershipTeam: TeamMember[] = [
  {
    name: "Richard Noble",
    role: "Founder & Lead Technician",
    bio: "Licensed structural pest control operator who personally trains every employee-based technician on California DPR compliance.",
    imageAlt: "Portrait of Richard Noble, founder of No More Mosquitoes",
  },
  {
    name: "Elijah Noble",
    role: "Operations & Customer Care",
    bio: "Handles scheduling, route optimization, and same-day communication so families always know when their technician arrives.",
    imageAlt: "Portrait of Elijah Noble, operations lead",
  },
  {
    name: "Maya Velasquez",
    role: "Field Quality Supervisor",
    bio: "Oversees product calibration, safety walk-throughs, and weather adjustments to maintain consistent results across Orange County.",
    imageAlt: "Portrait of Maya Velasquez, field quality supervisor",
  },
];
