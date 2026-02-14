export type FormStatus = "idle" | "submitting" | "success" | "error";

export type SubmissionResult = {
  status: FormStatus;
  message?: string;
};

export const emptySubmissionResult: SubmissionResult = { status: "idle" };

export async function postJson<TResponse = unknown>(endpoint: string, payload: unknown): Promise<TResponse> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Request to ${endpoint} failed with status ${response.status}`);
  }

  try {
    return (await response.json()) as TResponse;
  } catch (error) {
    return undefined as TResponse;
  }
}

export const isValidEmail = (value: string) => /.+@.+\..+/.test(value.trim());
export const isValidPhone = (value: string) => /^(\+1)?\s*\(?\d{3}\)?[-\s]?\d{3}[-\s]?\d{4}$/.test(value.trim());
