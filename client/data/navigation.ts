export type NavItem = {
  label: string;  // English fallback displayed if translation key missing
  path: string;
  key: string;    // unique React key; also used as tKey suffix for nav.* items
  tKey?: string;  // full i18n key (e.g. "nav.pricing" or "dashboard.navOverview")
  end: boolean;   // NavLink end prop — true = exact match, false = prefix match
};

// Unauthenticated visitors
export const GUEST_NAV_LINKS: NavItem[] = [
  { label: "Schedule Service", path: "/schedule",  key: "schedule",  end: true },
  { label: "Pricing & Plans",  path: "/pricing",   key: "pricing",   tKey: "nav.pricing",  end: true },
  { label: "Services",         path: "/services",  key: "services",  tKey: "nav.services", end: true },
  { label: "Our Story",        path: "/our-story", key: "ourStory",  tKey: "nav.ourStory", end: true },
  { label: "Reviews",          path: "/reviews",   key: "reviews",   tKey: "nav.reviews",  end: true },
  { label: "FAQ",              path: "/faq",       key: "faq",       tKey: "nav.faq",      end: true },
  { label: "Blog",             path: "/blog",      key: "blog",      tKey: "nav.blog",     end: true },
  { label: "Contact",          path: "/contact",   key: "contact",   tKey: "nav.contact",  end: true },
];

// Pre-customer (skipped onboarding, no active subscription) — minimal hamburger nav
export const PRE_CUSTOMER_DASHBOARD_LINKS: NavItem[] = [
  { label: "Profile", path: "/dashboard/profile", key: "preProfile", tKey: "dashboard.navProfile", end: true },
];

// Customer dashboard section links (hamburger + sidebar)
// end=true on all leaves — only the CTA (/dashboard, end=false) stays active across /dashboard/*
export const CUSTOMER_DASHBOARD_LINKS: NavItem[] = [
  { label: "Overview",       path: "/dashboard",              key: "dashOverview",     tKey: "dashboard.navOverview",     end: true },
  { label: "Appointments",   path: "/dashboard/appointments", key: "dashAppointments", tKey: "dashboard.navAppointments", end: true },
  { label: "Properties",     path: "/dashboard/properties",   key: "dashProperties",   tKey: "dashboard.navProperties",   end: true },
  { label: "Plan & Billing", path: "/dashboard/billing",      key: "dashBilling",      tKey: "dashboard.navBilling",      end: true },
  { label: "Profile",        path: "/dashboard/profile",      key: "dashProfile",      tKey: "dashboard.navProfile",      end: true },
  { label: "Shop",           path: "/dashboard/marketplace",  key: "dashMarketplace",                                     end: true },
  { label: "Help & Contact", path: "/dashboard/help",         key: "dashHelp",                                            end: true },
];

// Universal informational links — shown to all authenticated roles
export const UNIVERSAL_NAV_LINKS: NavItem[] = [
  { label: "Our Story", path: "/our-story", key: "uniOurStory", tKey: "nav.ourStory", end: true },
  { label: "Reviews",   path: "/reviews",   key: "uniReviews",  tKey: "nav.reviews",  end: true },
  { label: "FAQ",       path: "/faq",       key: "uniFaq",      tKey: "nav.faq",      end: true },
  { label: "Blog",      path: "/blog",      key: "uniBlog",     tKey: "nav.blog",     end: true },
  { label: "Contact",   path: "/contact",   key: "uniContact",  tKey: "nav.contact",  end: true },
];

// Admin-specific universal links (subset — no Reviews)
export const ADMIN_UNIVERSAL_LINKS: NavItem[] = [
  { label: "Our Story", path: "/our-story", key: "adminUniOurStory", tKey: "nav.ourStory", end: true },
  { label: "FAQ",       path: "/faq",       key: "adminUniFaq",      tKey: "nav.faq",      end: true },
  { label: "Blog",      path: "/blog",      key: "adminUniBlog",     tKey: "nav.blog",     end: true },
  { label: "Contact",   path: "/contact",   key: "adminUniContact",  tKey: "nav.contact",  end: true },
];

// Employee portal section links
export const EMPLOYEE_NAV_LINKS: NavItem[] = [
  { label: "Dashboard",       path: "/employee",              key: "empDashboard",    end: true  },
  { label: "Assignments",     path: "/employee/assignments",  key: "empAssignments",  end: false },
  { label: "Today's Route",   path: "/employee/route",        key: "empRoute",        end: true  },
  { label: "Onboarding",      path: "/employee/onboarding",  key: "empOnboarding",   end: true  },
  { label: "Messages",        path: "/employee/messages",    key: "empMessages",     end: true  },
  { label: "Timesheets",      path: "/employee/timesheets",  key: "empTimesheets",   end: true  },
  { label: "Profile",         path: "/employee/profile",     key: "empProfile",      end: true  },
];

// Admin section links
// end=false on sub-pages — allows /admin/customers/123 to highlight the Customers item
export const ADMIN_NAV_LINKS: NavItem[] = [
  { label: "Overview",           path: "/admin",                    key: "adminOverview",          end: true  },
  { label: "Customers",          path: "/admin/customers",          key: "adminCustomers",          end: false },
  { label: "Properties",         path: "/admin/properties",         key: "adminProperties",         end: false },
  { label: "Appointments",       path: "/admin/appointments",       key: "adminAppointments",       end: false },
  { label: "Visits",             path: "/admin/visits",             key: "adminVisits",             end: false },
  { label: "Messages",           path: "/admin/messages",           key: "adminMessages",           end: false },
  { label: "Tickets",            path: "/admin/tickets",            key: "adminTickets",            end: false },
  { label: "Employees",          path: "/admin/employees",          key: "adminEmployees",          end: false },
  { label: "Route Planning",     path: "/admin/route-planning",     key: "adminRoutePlanning",      end: false },
  { label: "Employee Tracking",  path: "/admin/employee-tracking",  key: "adminEmployeeTracking",   end: false },
  { label: "Billing",            path: "/admin/billing",            key: "adminBilling",            end: false },
  { label: "Revenue",            path: "/admin/revenue",            key: "adminRevenue",            end: false },
  { label: "Content",            path: "/admin/content",            key: "adminContent",            end: false },
  { label: "Pricing & Plans",    path: "/admin/pricing",            key: "adminPricing",            end: false },
  { label: "Service Areas",      path: "/admin/service-areas",      key: "adminServiceAreas",       end: false },
  { label: "Reports",            path: "/admin/reports",            key: "adminReports",            end: false },
  { label: "Business Hours",      path: "/admin/business-hours",     key: "adminBusinessHours",      end: false },
  { label: "Alerts",             path: "/admin/alerts",             key: "adminAlerts",             end: false },
  { label: "Notifications",      path: "/admin/notifications",      key: "adminNotifications",      end: false },
  { label: "Settings",           path: "/admin/settings",           key: "adminSettings",           end: false },
];
