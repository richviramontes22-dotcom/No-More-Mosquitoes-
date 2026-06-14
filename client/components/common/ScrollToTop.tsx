import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Resets scroll position on every route change.
 * - With a hash (e.g. /our-story#team), scrolls the target element into view
 *   once it's mounted (retries briefly since SPA content can render after
 *   the initial paint).
 * - Without a hash, scrolls to the top of the new page.
 */
export const ScrollToTop = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
      return;
    }

    const id = hash.slice(1);
    let attempts = 0;
    let frame: number;

    const tryScroll = () => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      attempts += 1;
      if (attempts < 20) {
        frame = requestAnimationFrame(tryScroll);
      } else {
        window.scrollTo(0, 0);
      }
    };

    frame = requestAnimationFrame(tryScroll);
    return () => cancelAnimationFrame(frame);
  }, [pathname, hash]);

  return null;
};

export default ScrollToTop;
