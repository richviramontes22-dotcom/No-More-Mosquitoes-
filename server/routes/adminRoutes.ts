import express from "express";
import { supabase } from "../lib/supabase";
import { optimizeRoute, validateAssignmentsForRouting, type AssignmentForRouting } from "../lib/routeOptimization";
import { requireAdminOrEmployee } from "../middleware/requireAdmin";

const router = express.Router();

/**
 * GET /api/admin/routes
 * Fetch routes for an employee on a specific date
 * Query params: employee_id (required), date (required, YYYY-MM-DD)
 */
router.get("/routes", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid authorization header" });
    }

    const token = authHeader.substring(7);
    const { employee_id, date } = req.query;

    if (!employee_id || !date) {
      return res.status(400).json({ error: "Missing employee_id or date query parameters" });
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date as string)) {
      return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
    }

    // Authenticate user
    const { data: user, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Require admin or employee role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.user.id)
      .single();
    if (!profile || !["admin", "employee"].includes(profile.role)) {
      return res.status(403).json({ error: "Forbidden: admin or employee access required" });
    }

    // Fetch routes for the employee on the given date, with their stops
    const { data: routes, error: routesError } = await supabase
      .from("routes")
      .select(`
        id,
        employee_id,
        date,
        status,
        total_distance_miles,
        total_duration_minutes,
        created_at,
        route_stops (
          id,
          sequence_number,
          assignment_id,
          arrival_eta,
          departure_eta,
          status,
          distance_from_prev_miles,
          duration_from_prev_minutes,
          assignments!inner (
            id,
            appointment_id,
            appointments!inner (
              id,
              scheduled_at,
              service_type,
              properties!inner (
                id,
                address,
                city,
                state,
                zip
              )
            )
          )
        )
      `)
      .eq("employee_id", employee_id as string)
      .gte("date", date as string)
      .lt("date", new Date(new Date(date as string).getTime() + 86400000).toISOString().split("T")[0])
      .order("created_at", { ascending: false });

    if (routesError) {
      return res.status(500).json({ error: routesError.message });
    }

    // Transform route_stops to match frontend RouteStop interface
    const transformedRoutes = (routes || []).map((route: any) => ({
      ...route,
      stops: (route.route_stops || []).map((stop: any) => ({
        id: stop.id,
        sequence_number: stop.sequence_number,
        assignment_id: stop.assignment_id,
        property_address: stop.assignments?.appointments?.properties?.address || "Unknown",
        arrival_eta: stop.arrival_eta,
        departure_eta: stop.departure_eta,
        status: stop.status,
        distance_from_prev_miles: stop.distance_from_prev_miles,
        duration_from_prev_minutes: stop.duration_from_prev_minutes,
      })),
    }));

    res.json({
      routes: transformedRoutes,
    });
  } catch (err) {
    console.error("[Admin Routes] Error fetching routes:", err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * POST /api/admin/routes/generate
 * Generate an optimized route for an employee on a specific date
 * Body: { employee_id: string, date: string (YYYY-MM-DD), territory_zip?: string }
 */
router.post("/routes/generate", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid authorization header" });
    }

    const token = authHeader.substring(7);
    const { employee_id, date, territory_zip } = req.body;

    if (!employee_id || !date) {
      return res.status(400).json({ error: "Missing employee_id or date" });
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
    }

    // Authenticate user and check admin role
    const { data: user, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.user.id)
      .single();

    if (profileError || !profile || profile.role !== "admin") {
      return res.status(403).json({ error: "Forbidden: Only admins can generate routes" });
    }

    // Fetch all assignments for the employee on the given date
    // Join with appointments and properties to get full context
    const { data: assignments, error: assignError } = await supabase
      .from("assignments")
      .select(
        `
        id,
        appointment_id,
        employee_id,
        status,
        started_at,
        completed_at,
        appointments!inner (
          id,
          scheduled_at,
          service_type,
          property_id,
          properties!inner (
            id,
            address,
            city,
            state,
            zip
          )
        )
      `
      )
      .eq("employee_id", employee_id)
      .gte("appointments.scheduled_at", `${date}T00:00:00Z`)
      .lt("appointments.scheduled_at", `${date}T23:59:59Z`)
      .order("appointments.scheduled_at");

    if (assignError) {
      return res.status(500).json({ error: assignError.message });
    }

    if (!assignments || assignments.length === 0) {
      return res.json({
        success: true,
        message: "No assignments found for this employee on this date",
        route: null,
        stops: [],
      });
    }

    // Transform assignments to format expected by optimization algorithm
    const formattedAssignments: AssignmentForRouting[] = assignments.map((a: any) => ({
      id: a.id,
      appointment_id: a.appointment_id,
      employee_id: a.employee_id,
      status: a.status,
      property: a.appointments.properties,
      // MVP: Mock geolocation - in production, geocode property address using Google Maps or Regrid
      geo: mockGeocodeAddress(a.appointments.properties.address, a.appointments.properties.zip),
      started_at: a.started_at,
      completed_at: a.completed_at,
    }));

    // Validate assignments have required data
    const validation = validateAssignmentsForRouting(formattedAssignments);
    if (!validation.valid) {
      return res.status(400).json({
        error: "Missing geolocation data for some assignments",
        details: validation.errors,
      });
    }

    // Optimize the route using nearest-neighbor algorithm
    const optimizedStops = optimizeRoute(formattedAssignments);

    if (optimizedStops.length === 0) {
      return res.json({
        success: true,
        message: "No assignments to optimize",
        route: null,
        stops: [],
      });
    }

    // Create the route in the database
    const { data: routeData, error: routeError } = await supabase
      .from("routes")
      .insert({
        employee_id,
        date,
        status: "draft",
        created_by: user.user.id,
        total_distance_miles: optimizedStops.reduce((sum, stop) => sum + stop.distanceFromPrevious, 0),
        total_duration_minutes: optimizedStops.reduce((sum, stop) => sum + stop.durationFromPrevious, 0),
      })
      .select("*")
      .single();

    if (routeError) {
      return res.status(500).json({ error: routeError.message });
    }

    // Create route_stops for each assignment in optimized order
    const stopsToCreate = optimizedStops.map((stop) => ({
      route_id: routeData.id,
      assignment_id: stop.assignment.id,
      sequence_number: stop.sequenceNumber,
      distance_from_prev_miles: stop.distanceFromPrevious,
      duration_from_prev_minutes: stop.durationFromPrevious,
      arrival_eta: stop.arrivalEta,
      departure_eta: stop.departureEta,
      status: "pending",
    }));

    const { data: stopsData, error: stopsError } = await supabase
      .from("route_stops")
      .insert(stopsToCreate)
      .select("*");

    if (stopsError) {
      // Clean up the route if stops failed to create
      await supabase.from("routes").delete().eq("id", routeData.id);
      return res.status(500).json({ error: stopsError.message });
    }

    // Return the complete route with stops
    res.json({
      success: true,
      route: routeData,
      stops: optimizedStops.map((stop, index) => ({
        ...stop,
        id: stopsData?.[index]?.id,
      })),
    });
  } catch (err) {
    console.error("[Admin Routes] Error generating route:", err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * GET /api/admin/routes/:routeId
 * Fetch a specific route with all its stops
 */
router.get("/routes/:routeId", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid authorization header" });
    }

    const token = authHeader.substring(7);
    const { routeId } = req.params;

    // Authenticate user
    const { data: user, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Require admin or employee role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.user.id)
      .single();
    if (!profile || !["admin", "employee"].includes(profile.role)) {
      return res.status(403).json({ error: "Forbidden: admin or employee access required" });
    }

    // Fetch route
    const { data: route, error: routeError } = await supabase
      .from("routes")
      .select("*")
      .eq("id", routeId)
      .single();

    if (routeError || !route) {
      return res.status(404).json({ error: "Route not found" });
    }

    // Fetch stops for this route
    const { data: stops, error: stopsError } = await supabase
      .from("route_stops")
      .select(`
        *,
        assignments!inner (
          id,
          appointment_id,
          appointments!inner (
            id,
            scheduled_at,
            service_type,
            properties!inner (
              id,
              address,
              city,
              state,
              zip
            )
          )
        )
      `)
      .eq("route_id", routeId)
      .order("sequence_number");

    if (stopsError) {
      return res.status(500).json({ error: stopsError.message });
    }

    res.json({
      route,
      stops: stops || [],
    });
  } catch (err) {
    console.error("[Admin Routes] Error fetching route:", err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * POST /api/admin/routes/:routeId/assign
 * Assign a draft route to the employee
 */
router.post("/routes/:routeId/assign", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid authorization header" });
    }

    const token = authHeader.substring(7);
    const { routeId } = req.params;

    // Authenticate and check admin
    const { data: user, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return res.status(403).json({ error: "Forbidden: Only admins can assign routes" });
    }

    // Update route status to assigned
    const { data: route, error: routeError } = await supabase
      .from("routes")
      .update({ status: "assigned" })
      .eq("id", routeId)
      .select("*")
      .single();

    if (routeError) {
      return res.status(500).json({ error: routeError.message });
    }

    res.json({
      success: true,
      route,
      message: "Route assigned to employee",
    });
  } catch (err) {
    console.error("[Admin Routes] Error assigning route:", err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * POST /api/admin/routes/:routeId/discard
 * Discard a draft route
 */
router.post("/routes/:routeId/discard", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid authorization header" });
    }

    const token = authHeader.substring(7);
    const { routeId } = req.params;

    // Authenticate and check admin
    const { data: user, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return res.status(403).json({ error: "Forbidden: Only admins can discard routes" });
    }

    // Delete the route (will cascade delete route_stops due to ON DELETE CASCADE)
    const { error: deleteError } = await supabase.from("routes").delete().eq("id", routeId);

    if (deleteError) {
      return res.status(500).json({ error: deleteError.message });
    }

    res.json({
      success: true,
      message: "Route discarded",
    });
  } catch (err) {
    console.error("[Admin Routes] Error discarding route:", err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * POST /api/admin/routes/:routeId/reorder
 * Update the sequence of stops in a route
 * Body: { stops: Array<{ id: string, sequence_number: number }> }
 */
router.post("/routes/:routeId/reorder", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid authorization header" });
    }

    const token = authHeader.substring(7);
    const { routeId } = req.params;
    const { stops } = req.body;

    if (!Array.isArray(stops) || stops.length === 0) {
      return res.status(400).json({ error: "Invalid stops array" });
    }

    // Authenticate and check admin
    const { data: user, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return res.status(403).json({ error: "Forbidden: Only admins can reorder routes" });
    }

    // Update each stop's sequence number
    const updatePromises = stops.map((stop) =>
      supabase.from("route_stops").update({ sequence_number: stop.sequence_number }).eq("id", stop.id)
    );

    await Promise.all(updatePromises);

    // Fetch updated stops
    const { data: updatedStops, error: fetchError } = await supabase
      .from("route_stops")
      .select("*")
      .eq("route_id", routeId)
      .order("sequence_number");

    if (fetchError) {
      return res.status(500).json({ error: fetchError.message });
    }

    res.json({
      success: true,
      stops: updatedStops,
    });
  } catch (err) {
    console.error("[Admin Routes] Error reordering route:", err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * Mock geocoding function - returns approximate coordinates based on zip code
 * In production, integrate Google Maps Geocoding API or Regrid API
 */
function mockGeocodeAddress(address: string, zip: string) {
  // Simple mock: return a point based on zip code hash + small random offset
  // In production, use real geocoding service
  const zipHash = zip
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const lat = 37.7 + (zipHash % 100) / 1000;
  const lon = -122.4 + (zipHash % 100) / 1000;

  return {
    latitude: lat,
    longitude: lon,
  };
}

export default router;
