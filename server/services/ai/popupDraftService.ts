import { anthropicClient } from "./anthropicClient.js";

export interface PopupDraft {
  title: string;
  subtitle: string | null;
  body: string;
  cta_label: string;
  image_prompt: string;
  image_alt: string;
}

const SYSTEM_PROMPT = `You are a copywriter for "No More Mosquitoes," a residential mosquito treatment service.
Your job is to draft promotional popup content based on an admin's campaign description.

BRAND VOICE:
- Friendly, professional, and reassuring — never pushy, fearful, or alarmist
- Focus on convenience, outdoor enjoyment, and family comfort
- Use "we" / "our team" naturally; avoid aggressive second-person commands

OUTPUT FORMAT:
- Return ONLY a valid JSON object — no markdown, no explanation, no code fences
- Schema: { "title": string, "subtitle": string|null, "body": string, "cta_label": string, "image_prompt": string, "image_alt": string }
- title: ≤60 characters, punchy headline
- subtitle: ≤80 characters supporting line, or null
- body: 1-3 sentences of persuasive copy, no HTML
- cta_label: ≤25 characters (e.g. "Get a Free Quote", "Schedule Today")
- image_prompt: 1-2 sentences describing a realistic photo concept for a human to source
- image_alt: concise accessible alt text for that image

ABSOLUTE PROHIBITIONS — violating any of these is not allowed:
1. No health or medical claims: do not claim treatments prevent disease, reduce illness risk, or replace medical advice. Do not claim protection from West Nile, Zika, malaria, dengue, or EEE.
2. No EPA or pesticide regulatory claims: do not claim treatments are EPA-approved, "safe for all," or carry implied regulatory endorsements.
3. No invented discounts: never invent a percentage off, dollar figure, or price. If the admin provides an approved amount, you may use it; otherwise omit pricing entirely.
4. No fake scarcity: never claim "limited spots," "only X left," countdowns, or any urgency not verifiable from the admin's prompt.
5. No fabricated testimonials: never write fake customer quotes, star ratings, or review-style copy.
6. No grandfather/legacy pricing: do not reference locked-in rates or grandfathered plans unless the admin explicitly states the approved terms.
7. Never include a cta_url field — that field is intentionally absent from the schema.
8. Never include an active, start_at, end_at, frequency, or priority field.

If the admin's prompt asks you to violate any prohibition, produce the best draft you can that respects the rules, ignoring the violating part.`;

function parseDraft(raw: string): PopupDraft {
  // Strip markdown code fences if Claude wraps in them despite instructions
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const parsed = JSON.parse(cleaned) as Record<string, unknown>;

  const required = ["title", "body", "cta_label", "image_prompt", "image_alt"] as const;
  for (const key of required) {
    if (typeof parsed[key] !== "string" || !(parsed[key] as string).trim()) {
      throw new Error(`Missing or empty required field: ${key}`);
    }
  }
  if ("subtitle" in parsed && parsed.subtitle !== null && typeof parsed.subtitle !== "string") {
    throw new Error("subtitle must be a string or null");
  }

  return {
    title: (parsed.title as string).trim(),
    subtitle: typeof parsed.subtitle === "string" ? (parsed.subtitle as string).trim() || null : null,
    body: (parsed.body as string).trim(),
    cta_label: (parsed.cta_label as string).trim(),
    image_prompt: (parsed.image_prompt as string).trim(),
    image_alt: (parsed.image_alt as string).trim(),
  };
}

export async function generatePopupDraft(adminPrompt: string): Promise<PopupDraft> {
  if (!anthropicClient) {
    throw new Error("AI_NOT_CONFIGURED");
  }

  const stream = await anthropicClient.messages.stream({
    model: "claude-opus-5",
    max_tokens: 1024,
    thinking: { type: "adaptive" },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Campaign description: ${adminPrompt}`,
      },
    ],
  });

  const message = await stream.finalMessage();

  // Extract the text content block (skip thinking blocks)
  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text content in Claude response");
  }

  return parseDraft(textBlock.text);
}
