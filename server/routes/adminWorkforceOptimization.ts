import { Router } from "express";
import { requireAdmin } from "../middleware/requireAdmin";
import { getWorkforceOptimization } from "../services/analytics/workforceOptimizationService";

const router = Router();

// GET /api/admin/workforce-optimization
// Read-only. Never mutates employee schedules, service areas, or
// assignments — decision support only, per the explicit constraints.
router.get("/workforce-optimization", requireAdmin, async (req, res) => {
  const { date_from, date_to } = req.query as Record<string, string>;

  try {
    const result = await getWorkforceOptimization({
      dateFrom: date_from || undefined,
      dateTo: date_to || undefined,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
