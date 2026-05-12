import React, { createContext, useContext, useCallback, useMemo } from "react";

export type LogoStyle = "circular" | "banner" | "full-text";

interface LogoContextType {
  logoStyle: LogoStyle;
  setLogoStyle: (style: LogoStyle) => void;
}

const LogoContext = createContext<LogoContextType | undefined>(undefined);

export const LogoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const logoStyle: LogoStyle = "banner";
  const setLogoStyle = useCallback(() => {}, []); // No-op now

  const value = useMemo(() => ({ logoStyle, setLogoStyle }), [logoStyle, setLogoStyle]);

  return (
    <LogoContext.Provider value={value}>
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
