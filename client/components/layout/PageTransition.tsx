import { motion } from "framer-motion";
import { ReactNode } from "react";

interface PageTransitionProps {
  children: ReactNode;
  locationKey: string;
}

export const PageTransition = ({ children, locationKey }: PageTransitionProps) => {
  return (
    <motion.div
      key={locationKey}
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={{ 
        duration: 0.35, 
        ease: [0.23, 1, 0.32, 1], // Custom cubic-bezier for premium feel
      }}
      className="flex-1 w-full"
    >
      {children}
    </motion.div>
  );
};
