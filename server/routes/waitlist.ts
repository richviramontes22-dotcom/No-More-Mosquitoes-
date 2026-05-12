import { Router, RequestHandler } from "express";
import { supabase } from "../lib/supabase";

const router = Router();

/**
 * POST /api/waitlist
 * Adds an email to the waitlist
 */
const handleWaitlistSignup: RequestHandler = async (req, res) => {
  try {
    const { email, name, phoneNumber } = req.body;

    // Validate email
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email is required" });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // Insert into waitlist table
    const { data, error } = await supabase
      .from("waitlist")
      .insert({
        email: normalizedEmail,
        name: name ? String(name).trim() : null,
        phone: phoneNumber ? String(phoneNumber).trim() : null,
        created_at: new Date().toISOString()
      })
      .select();

    if (error) {
      // If it's a unique constraint violation, user is already on waitlist
      if (error.message.includes("duplicate") || error.message.includes("unique")) {
        return res.status(200).json({
          success: true,
          message: "You're already on our waitlist!",
          alreadySignedUp: true
        });
      }
      throw error;
    }

    res.status(201).json({
      success: true,
      message: "Successfully added to waitlist",
      data: data?.[0]
    });
  } catch (err: any) {
    console.error("[Waitlist] Error:", err);
    res.status(500).json({
      error: "Failed to add to waitlist. Please try again later."
    });
  }
};

/**
 * GET /api/waitlist/count
 * Returns the total number of people on the waitlist (optional, for display)
 */
const handleWaitlistCount: RequestHandler = async (req, res) => {
  try {
    const { count, error } = await supabase
      .from("waitlist")
      .select("*", { count: "exact", head: true });

    if (error) throw error;

    res.json({ count: count || 0 });
  } catch (err: any) {
    console.error("[Waitlist Count] Error:", err);
    res.status(500).json({ error: "Failed to fetch waitlist count" });
  }
};

router.post("/", handleWaitlistSignup);
router.get("/count", handleWaitlistCount);

export default router;
