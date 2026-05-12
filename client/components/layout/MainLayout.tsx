import { Outlet, useLocation } from "react-router-dom";
import SiteFooter from "./SiteFooter";
import SiteHeader from "./SiteHeader";
import ChatWidget from "../common/ChatWidget";

const MainLayout = () => {
  const location = useLocation();
  const isHomePage = location.pathname === "/";

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground overflow-x-hidden">
      <SiteHeader />
      <main id="main-content" className={`flex-1 ${!isHomePage ? "pt-[136px] sm:pt-[152px]" : ""}`}>
        <Outlet />
      </main>
      <SiteFooter />
      <ChatWidget />
    </div>
  );
};

export default MainLayout;
