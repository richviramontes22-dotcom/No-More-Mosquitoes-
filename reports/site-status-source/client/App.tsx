import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import MainLayout from "@/components/layout/MainLayout";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import PlaceholderPage from "./pages/Placeholder";

const queryClient = new QueryClient();

const PLACEHOLDER_ROUTES = [
  {
    path: "/pricing",
    title: "Pricing & Plans",
    description:
      "Dive into acreage-based tiers, visit frequencies, and transparent billing so you know exactly what every program includes before you book.",
  },
  {
    path: "/services",
    title: "Services",
    description:
      "Explore how we tackle mosquitoes, ticks, ants, spiders, and more with eco-conscious treatments and detailed completion videos after every visit.",
  },
  {
    path: "/our-story",
    title: "Our Story",
    description:
      "Meet the family behind No More Mosquitoes and learn how Grandma’s backyard sparked a mission to protect every gathering in Orange County.",
  },
  {
    path: "/reviews",
    title: "Reviews",
    description:
      "Hear from OC neighbors about their experience with our friendly technicians, responsive communication, and mosquito-free backyards.",
  },
  {
    path: "/service-area",
    title: "Service Area",
    description:
      "See the cities and neighborhoods we currently serve. Outside the map? Join the waitlist so we can alert you when routes open.",
  },
  {
    path: "/faq",
    title: "FAQ",
    description:
      "Find answers about safety, product ingredients, visit timing, weather adjustments, and what to expect on service day.",
  },
  {
    path: "/blog",
    title: "Blog",
    description:
      "Stay ahead of seasonal pest trends and get prevention tips straight from our licensed Orange County technicians.",
  },
  {
    path: "/schedule",
    title: "Schedule Service",
    description:
      "We’re finalizing the automated scheduling flow. In the meantime, share your address, preferred frequency, and we’ll confirm your route within one business day.",
    callToActionLabel: "Request My First Visit",
  },
  {
    path: "/login",
    title: "Customer Login",
    description:
      "Access visit videos, technician notes, ETA updates, invoices, and auto-pay settings in our secure customer portal.",
    callToActionLabel: "Email Me Portal Access",
    callToActionPath: "/contact",
  },
  {
    path: "/contact",
    title: "Contact",
    description:
      "Reach our local office for quotes, billing, or technician dispatch. We reply to calls, texts, and emails Monday–Saturday 7a–7p.",
    callToActionLabel: "Call or Text Now",
    callToActionPath: "tel:+19497630492",
  },
  {
    path: "/privacy",
    title: "Privacy Policy",
    description:
      "Review how we handle your contact details, property data, and consent preferences across analytics, call tracking, and service reminders.",
    callToActionLabel: "Request Data Report",
  },
  {
    path: "/terms",
    title: "Terms of Service",
    description:
      "Understand scheduling expectations, safety commitments, guarantees, and how we handle weather-related adjustments.",
  },
  {
    path: "/guarantee",
    title: "Satisfaction Guarantee",
    description:
      "If mosquitoes return between scheduled visits, we re-service at no charge. Learn exactly how our 100% guarantee protects your home.",
  },
  {
    path: "/licenses",
    title: "Licenses & Insurance",
    description:
      "View current California structural pest control licensing, insurance certificates, and safety documentation.",
  },
];

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<MainLayout />}>
            <Route index element={<Index />} />
            {PLACEHOLDER_ROUTES.map((route) => (
              <Route
                key={route.path}
                path={route.path}
                element={
                  <PlaceholderPage
                    title={route.title}
                    description={route.description}
                    callToActionLabel={route.callToActionLabel}
                    callToActionPath={route.callToActionPath}
                  />
                }
              />
            ))}
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
