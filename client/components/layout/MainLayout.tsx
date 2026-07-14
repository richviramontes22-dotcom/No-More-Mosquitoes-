import { Outlet, useLocation } from "react-router-dom";
import SiteFooter from "./SiteFooter";
import SiteHeader from "./SiteHeader";
import ChatWidget from "../common/ChatWidget";
import PromotionalPopup from "../promotions/PromotionalPopup";

const MainLayout = () => {
  const location = useLocation();
  const isHomePage = location.pathname === "/";

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground overflow-x-hidden">
      <SiteHeader />
      <main id="main-content" className={`flex-1 ${!isHomePage ? "pt-[96px] sm:pt-[110px] md:pt-[126px]" : ""}`}>
        <Outlet />
      </main>
      <SiteFooter />
      <ChatWidget />
      <PromotionalPopup />
    </div>
  );
};

export default MainLayout;
