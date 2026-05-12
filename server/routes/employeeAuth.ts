import { Router } from "express";

const router = Router();

router.post("/login", (_req, res) => {
  res.status(501).json({ error: "Not implemented: integrate your auth provider and return a JWT with employee claims." });
});

export default router;
