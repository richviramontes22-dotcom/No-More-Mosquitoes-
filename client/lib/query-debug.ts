/**
 * Query Debugging Utility
 * Provides enhanced logging for React Query state changes
 */

export interface QueryDebugInfo {
  hookName: string;
  queryKey: string;
  enabled: boolean;
  status: string;
  dataCount: number;
  error: string | null;
  isLoading: boolean;
  timestamp: string;
}

export const logQueryState = (info: QueryDebugInfo) => {
  const icon = info.status === "success" ? "✓" : 
               info.status === "error" ? "✗" : 
               info.status === "pending" ? "⏳" : "?";
  
  console.log(
    `[${info.hookName}] ${icon} status=${info.status} enabled=${info.enabled} data=${info.dataCount} error=${info.error ? "YES" : "NO"}`,
    info
  );
};

export const logPageState = (pageName: string, state: {
  authReady: boolean;
  userId: string | null;
  isLoading: boolean;
  dataCount: number;
  hasError: boolean;
  renderBranch: "loading" | "error" | "empty" | "data";
}) => {
  console.log(`[${pageName}] PAGE STATE:`, {
    authReady: state.authReady,
    userId: state.userId ? "***" : "none",
    isLoading: state.isLoading,
    dataCount: state.dataCount,
    hasError: state.hasError,
    renderBranch: state.renderBranch
  });
};
