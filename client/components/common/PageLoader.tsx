import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

interface PageLoaderProps {
  isLoading: boolean;
  type?: "bar" | "full";
}

export const PageLoader = ({ isLoading, type = "bar" }: PageLoaderProps) => {
  const [show, setShow] = useState(isLoading);

  useEffect(() => {
    if (isLoading) {
      setShow(true);
    } else {
      const timeout = setTimeout(() => setShow(false), 300);
      return () => clearTimeout(timeout);
    }
  }, [isLoading]);

  return (
    <AnimatePresence>
      {show && (
        <>
          {/* Top Progress Bar */}
          <motion.div
            initial={{ scaleX: 0, originX: 0 }}
            animate={{ 
              scaleX: isLoading ? 0.9 : 1,
              transition: { duration: isLoading ? 2 : 0.3, ease: "easeOut" }
            }}
            exit={{ opacity: 0 }}
            className="fixed top-0 left-0 right-0 h-1 bg-primary z-[9999] shadow-[0_0_8px_rgba(var(--primary),0.5)]"
          />

          {/* Full Page Overlay (Optional) */}
          {type === "full" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[9998] flex items-center justify-center"
            >
              <div className="flex flex-col items-center gap-4">
                <motion.div
                  animate={{
                    scale: [1, 1.1, 1],
                    opacity: [0.5, 1, 0.5],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center"
                >
                  <div className="w-6 h-6 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                </motion.div>
                <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground animate-pulse">
                  Loading Experience
                </p>
              </div>
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  );
};
