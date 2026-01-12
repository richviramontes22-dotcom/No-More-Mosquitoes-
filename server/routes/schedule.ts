import type { RequestHandler } from "express";
import { randomUUID } from "node:crypto";

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

const createTicketId = () => {
  try {
    return randomUUID().split("-")[0]?.toUpperCase() ?? `REQ-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  } catch (error) {
    return `REQ-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  }
};

export const handleScheduleRequest: RequestHandler = (req, res) => {
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

  const response: ScheduleResponse = {
    success: true,
    ticketId: createTicketId(),
    message: "Schedule request received",
  };

  // In a production system you might enqueue this request, store it in a database, or notify a CRM here.
  // For now we simply acknowledge the request so the client can confirm receipt.

  res.status(200).json(response);
};
