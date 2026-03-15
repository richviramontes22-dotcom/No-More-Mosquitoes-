import type { RequestHandler } from "express";
import { supabase } from "../lib/supabase";

import type { ScheduleRequestPayload, ScheduleResponse } from "@shared/api";

const REQUIRED_FIELDS: Array<keyof ScheduleRequestPayload> = [
  "fullName",
  "email",
  "phone",
  "serviceAddress",
  "zipCode",
  "serviceFrequency",
  "preferredDate",
  "preferredContactMethod",
  "submittedAt",
];

export const handleScheduleRequest: RequestHandler = async (req, res) => {
  const payload = req.body as ScheduleRequestPayload | undefined;

  if (!payload) {
    res.status(400).json({ message: "Missing request body" });
    return;
  }

  const missingField = REQUIRED_FIELDS.find((field) => {
    const value = payload[field];
    if (typeof value === "string") {
      return value.trim() === "";
    }
    return value === undefined || value === null;
  });

  if (missingField) {
    res.status(400).json({ message: `Missing required field: ${missingField}` });
    return;
  }

  try {
    const authHeader = req.headers.authorization;
    let userId = payload.userId;

    if (authHeader) {
      const token = authHeader.split(" ")[1];
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (user) {
        userId = user.id;
      }
    }

    // Persist to Supabase
    const { data, error } = await supabase
      .from("schedule_requests")
      .insert({
        full_name: payload.fullName,
        email: payload.email,
        phone: payload.phone,
        address: payload.serviceAddress,
        city: payload.city,
        state: payload.state,
        zip: payload.zipCode,
        frequency: payload.serviceFrequency,
        preferred_date: payload.preferredDate,
        contact_method: payload.preferredContactMethod,
        acreage: payload.acreage,
        notes: payload.notes,
        status: "new",
      })
      .select()
      .single();

    if (error) {
      console.error("Error saving schedule request to Supabase:", error);
    }

    // If userId and propertyId are present, also insert into appointments
    if (userId && payload.propertyId && !payload.propertyId.startsWith("prop-system")) {
      const { error: appointmentError } = await supabase
        .from("appointments")
        .insert({
          user_id: userId,
          property_id: payload.propertyId,
          status: "requested",
          scheduled_at: payload.preferredDate,
          service_type: "Mosquito Service",
          frequency: payload.serviceFrequency,
          notes: payload.notes
        });

      if (appointmentError) {
        console.error("Error saving appointment to Supabase:", appointmentError);
      }
    }

    const response: ScheduleResponse = {
      success: true,
      ticketId: data?.id?.split("-")[0]?.toUpperCase() ?? `REQ-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      message: "Schedule request received and saved",
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Internal error handling schedule request:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
