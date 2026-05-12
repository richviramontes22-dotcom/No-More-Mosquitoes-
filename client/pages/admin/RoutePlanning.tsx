import { useState, useEffect } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, Navigation, Trash2 } from "lucide-react";
import { adminApi } from "@/lib/adminApi";

interface RouteStop {
  id: string;
  sequence_number: number;
  assignment_id: string;
  property_address: string;
  arrival_eta: string;
  departure_eta: string;
  status: "pending" | "arrived" | "completed" | "skipped";
  distance_from_prev_miles: number;
  duration_from_prev_minutes: number;
}

interface Route {
  id: string;
  employee_id: string;
  date: string;
  status: "draft" | "assigned" | "in_progress" | "completed";
  total_distance_miles: number;
  total_duration_minutes: number;
  stops: RouteStop[];
}

const RoutePlanning = () => {
  const { toast } = useToast();
  
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [employees, setEmployees] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  
  const [generatingRoute, setGeneratingRoute] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [loadingRoutes, setLoadingRoutes] = useState(false);

  // Load employees on mount
  useEffect(() => {
    loadEmployees();
  }, []);

  // Load routes when date/employee changes
  useEffect(() => {
    if (selectedEmployeeId && selectedDate) {
      loadRoutes();
    }
  }, [selectedEmployeeId, selectedDate]);

  const loadEmployees = async () => {
    try {
      setLoadingEmployees(true);
      const data = await adminApi("/api/admin/employees");
      const active = (data || []).filter((e: any) => e.status === "active");
      setEmployees(
        active.map((e: any) => ({
          id: e.id,
          name: e.name || "Employee",
          email: e.email || "",
        }))
      );
    } catch (err) {
      toast({ title: "Error", description: "Failed to load employees", variant: "destructive" });
    } finally {
      setLoadingEmployees(false);
    }
  };

  const loadRoutes = async () => {
    try {
      setLoadingRoutes(true);
      const data = await adminApi(`/api/admin/routes?employee_id=${selectedEmployeeId}&date=${selectedDate}`);
      setRoutes(data.routes || []);
      if (data.routes?.length > 0) {
        setSelectedRoute(data.routes[0]);
      }
    } catch (err) {
      console.error("Error loading routes:", err);
    } finally {
      setLoadingRoutes(false);
    }
  };

  const handleGenerateRoute = async () => {
    if (!selectedEmployeeId || !selectedDate) {
      toast({
        title: "Error",
        description: "Please select both employee and date",
        variant: "destructive",
      });
      return;
    }

    try {
      setGeneratingRoute(true);
      
      const data = await adminApi("/api/admin/routes/generate", "POST", {
        employee_id: selectedEmployeeId,
        date: selectedDate,
      });
      
      if (data.route) {
        setRoutes([...routes, data.route]);
        setSelectedRoute(data.route);
        
        toast({
          title: "Success",
          description: `Generated optimized route with ${data.stops.length} stops`,
        });
      } else {
        toast({
          title: "No Assignments",
          description: "No assignments found for this employee on this date",
        });
      }
    } catch (err) {
      console.error("Error generating route:", err);
      toast({
        title: "Error",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setGeneratingRoute(false);
    }
  };

  const handleAssignRoute = async (routeId: string) => {
    try {
      const data = await adminApi(`/api/admin/routes/${routeId}/assign`, "POST");
      
      // Update local state
      setRoutes(routes.map(r => r.id === routeId ? data.route : r));
      setSelectedRoute(data.route);
      
      toast({
        title: "Route Assigned",
        description: "Route has been assigned to the employee",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: (err as Error).message,
        variant: "destructive",
      });
    }
  };

  const handleDiscardRoute = async (routeId: string) => {
    try {
      await adminApi(`/api/admin/routes/${routeId}/discard`, "POST");
      setRoutes(routes.filter(r => r.id !== routeId));
      if (selectedRoute?.id === routeId) {
        setSelectedRoute(null);
      }
      
      toast({
        title: "Route Discarded",
        description: "Route has been removed",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: (err as Error).message,
        variant: "destructive",
      });
    }
  };

  const statusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-yellow-100 text-yellow-800",
      assigned: "bg-blue-100 text-blue-800",
      in_progress: "bg-purple-100 text-purple-800",
      completed: "bg-green-100 text-green-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="grid gap-8 pb-20">
      <SectionHeading
        eyebrow="Operations"
        title="Route Planning"
        description="Generate and manage optimized routes for employees."
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
        <div className="space-y-8">
          {/* Route Generation Card */}
          <Card className="rounded-[32px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
            <CardHeader className="bg-primary/5 p-8 border-b border-border/40">
              <div className="flex items-center gap-3 text-primary mb-1">
                <Navigation className="h-6 w-6" />
                <CardTitle className="text-2xl font-display font-bold">Generate Route</CardTitle>
              </div>
              <CardDescription className="text-base">
                Create an optimized route for an employee on a specific date.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Date</Label>
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="rounded-xl h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Employee</Label>
                  <select
                    value={selectedEmployeeId}
                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                    className="h-11 w-full rounded-xl border border-input bg-background px-4 text-sm font-medium"
                    disabled={loadingEmployees}
                  >
                    <option value="">Select an employee...</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <Button
                className="w-full h-12 rounded-xl font-bold shadow-brand"
                onClick={handleGenerateRoute}
                disabled={generatingRoute || !selectedEmployeeId}
              >
                {generatingRoute ? "Generating..." : "Generate Optimized Route"}
              </Button>
            </CardContent>
          </Card>

          {/* Route Details */}
          {selectedRoute && (
            <Card className="rounded-[32px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
              <CardHeader className="bg-primary/5 p-8 border-b border-border/40">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3 text-primary">
                    <MapPin className="h-6 w-6" />
                    <div>
                      <CardTitle className="text-2xl font-display font-bold">Route Details</CardTitle>
                      <CardDescription className="text-base">
                        {selectedRoute.stops?.length || 0} stops • {selectedRoute.total_distance_miles?.toFixed(1) || 0} miles
                      </CardDescription>
                    </div>
                  </div>
                  <Badge className={statusColor(selectedRoute.status)}>
                    {selectedRoute.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-8">
                {selectedRoute.stops && selectedRoute.stops.length > 0 ? (
                  <div className="rounded-2xl border border-border/40 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30 border-none">
                          <TableHead className="font-bold text-[10px] uppercase tracking-widest pl-6 py-4 w-12">Seq</TableHead>
                          <TableHead className="font-bold text-[10px] uppercase tracking-widest py-4">Address</TableHead>
                          <TableHead className="font-bold text-[10px] uppercase tracking-widest py-4 text-right">ETA</TableHead>
                          <TableHead className="font-bold text-[10px] uppercase tracking-widest pr-6 py-4 text-right">Distance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedRoute.stops.map((stop) => {
                          const eta = new Date(stop.arrival_eta);
                          return (
                            <TableRow key={stop.id} className="border-border/40 group hover:bg-muted/10 transition-colors">
                              <TableCell className="pl-6 py-4 font-bold text-sm">{stop.sequence_number}</TableCell>
                              <TableCell className="py-4 text-sm">{stop.property_address || "Unknown"}</TableCell>
                              <TableCell className="py-4 text-sm text-right">
                                {eta.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </TableCell>
                              <TableCell className="pr-6 py-4 text-sm text-right">
                                {stop.distance_from_prev_miles?.toFixed(1) || 0} mi
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No stops in this route
                  </div>
                )}

                <div className="flex gap-4 mt-8">
                  {selectedRoute.status === "draft" && (
                    <>
                      <Button
                        className="flex-1 h-11 rounded-xl font-bold shadow-brand"
                        onClick={() => handleAssignRoute(selectedRoute.id)}
                      >
                        Assign Route
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 h-11 rounded-xl font-bold text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => handleDiscardRoute(selectedRoute.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Discard
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Routes List Sidebar */}
        <div className="space-y-4">
          <Card className="rounded-[32px] border-border/60 bg-card/95 shadow-soft">
            <CardHeader className="p-6">
              <CardTitle className="text-xl font-display font-bold">Routes for {selectedDate}</CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6 space-y-2 max-h-96 overflow-y-auto">
              {loadingRoutes ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Loading routes...
                </div>
              ) : routes.length > 0 ? (
                routes.map((route) => (
                  <button
                    key={route.id}
                    onClick={() => setSelectedRoute(route)}
                    className={`w-full p-4 rounded-xl border transition-all text-left ${
                      selectedRoute?.id === route.id
                        ? "border-primary bg-primary/5"
                        : "border-border/40 hover:border-primary/20 hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm">{route.stops?.length || 0} stops</span>
                      <Badge className={statusColor(route.status)}>
                        {route.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {route.total_duration_minutes?.toFixed(0) || 0} min
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No routes yet. Generate one above.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default RoutePlanning;
