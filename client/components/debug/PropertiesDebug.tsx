import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useProperties } from "@/hooks/dashboard/useProperties";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const PropertiesDebug = () => {
  const { user, isAuthenticated, isHydrated } = useAuth();
  const { data: properties, isLoading, error, status } = useProperties(user?.id);
  const renderCountRef = useRef(0);

  // Only log when userId changes (not on every render)
  useEffect(() => {
    renderCountRef.current++;
    console.log("=== PropertiesDebug State Update ===");
    console.log("Render count:", renderCountRef.current);
    console.log("Auth state:", { isHydrated, isAuthenticated, userId: user?.id });
    console.log("Hook state:", { isLoading, error, propertiesCount: properties?.length, status });
  }, [user?.id]); // Only trigger when userId changes

  return (
    <Card className="mb-8 border-amber-300 bg-amber-50">
      <CardHeader>
        <CardTitle className="text-amber-900">🔍 Properties Debug Info</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 font-mono text-sm">
        <div>
          <div className="font-bold text-amber-900">Auth Status:</div>
          <div className="ml-4 text-amber-800">
            <div>isHydrated: <Badge variant="outline">{String(isHydrated)}</Badge></div>
            <div>isAuthenticated: <Badge variant="outline">{String(isAuthenticated)}</Badge></div>
            <div>userId: <Badge variant="outline">{user?.id || "undefined"}</Badge></div>
            <div>userName: <Badge variant="outline">{user?.name || "undefined"}</Badge></div>
          </div>
        </div>

        <div>
          <div className="font-bold text-amber-900">Hook State:</div>
          <div className="ml-4 text-amber-800">
            <div>status: <Badge variant="outline">{status}</Badge></div>
            <div>isLoading: <Badge variant="outline">{String(isLoading)}</Badge></div>
            <div>propertiesCount: <Badge variant="outline">{properties?.length || 0}</Badge></div>
            <div>error: <Badge variant="outline">{error ? "YES" : "NO"}</Badge></div>
            <div>isQueryEnabled: <Badge variant="outline">{String(!!user?.id)}</Badge></div>
            {error && <div className="mt-2 text-red-600">Error: {String(error)}</div>}
          </div>
        </div>

        <div>
          <div className="font-bold text-amber-900">Properties Data:</div>
          <div className="ml-4 max-h-48 overflow-auto rounded bg-white p-2 text-xs">
            <pre>{JSON.stringify(properties, null, 2)}</pre>
          </div>
        </div>

        <div className="text-amber-700">
          Render count: {renderCountRef.current} | Check console for detailed logs
        </div>
      </CardContent>
    </Card>
  );
};
