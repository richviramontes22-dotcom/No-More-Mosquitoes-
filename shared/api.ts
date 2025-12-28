/**
 * Shared code between client and server
 * Useful to share types between client and server
 * and/or small pure JS functions that can be used on both client and server
 */

/**
 * Example response type for /api/demo
 */
export interface DemoResponse {
  message: string;
}

export interface ScheduleRequestPayload {
  fullName: string;
  email: string;
  phone: string;
  serviceAddress: string;
  zipCode: string;
  serviceFrequency: "single" | "monthly" | "biweekly" | "weekly";
  preferredDate: string;
  preferredContactMethod: "text" | "call" | "email";
  notes?: string;
  origin?: string;
  submittedAt: string;
}

export interface ScheduleResponse {
  success: boolean;
  ticketId: string;
  message: string;
}
