import React, { createContext, useContext } from "react";

export type LogoStyle = "circular" | "banner" | "full-text";

interface LogoContextType {
  logoStyle: LogoStyle;
  setLogoStyle: (style: LogoStyle) => void;
}

const LogoContext = createContext<LogoContextType | undefined>(undefined);

export const LogoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const logoStyle: LogoStyle = "banner";
  const setLogoStyle = () => {}; // No-op now

  return (
    <LogoContext.Provider value={{ logoStyle, setLogoStyle }}>
      {children}
    </LogoContext.Provider>
  );
};

export const useLogo = () => {
  const context = useContext(LogoContext);
  if (context === undefined) {
    throw new Error("useLogo must be used within a LogoProvider");
  }
  return context;
};
