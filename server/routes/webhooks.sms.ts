import { Router } from "express";

const router = Router();

router.post("/sms", (_req, res) => {
  // Expect application/x-www-form-urlencoded from Twilio; ensure parser configured in host app
  res.status(200).end();
});

export default router;
