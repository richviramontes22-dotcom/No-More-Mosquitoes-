import { Router } from "express";
import { requireAdmin } from "../middleware/requireAdmin";
import { getTerritoryIntelligence, type ServiceStatus } from "../services/analytics/territoryIntelligenceService";

const router = Router();

const VALID_SERVICE_STATUS: ServiceStatus[] = ["active", "inactive", "unmapped"];

// GET /api/admin/territory-intelligence
// Read-only. Never mutates service_areas, leads, or any other table — this
// is decision support only, per the explicit "do not auto-change service
// areas" constraint.
router.get("/territory-intelligence", requireAdmin, async (req, res) => {
  const { state, county, service_status, area_filter, date_from, date_to } = req.query as Record<string, string>;

  if (service_status && !VALID_SERVICE_STATUS.includes(service_status as ServiceStatus)) {
    return res.status(400).json({ error: `service_status must be one of: ${VALID_SERVICE_STATUS.join(", ")}` });
  }
  if (area_filter && !["in_area", "out_of_area"].includes(area_filter)) {
    return res.status(400).json({ error: "area_filter must be 'in_area' or 'out_of_area'" });
  }

  try {
    const result = await getTerritoryIntelligence({
      state: state || undefined,
      county: county || undefined,
      serviceStatus: (service_status as ServiceStatus) || undefined,
      areaFilter: (area_filter as "in_area" | "out_of_area") || undefined,
      dateFrom: date_from || undefined,
      dateTo: date_to || undefined,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
