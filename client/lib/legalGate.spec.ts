import { describe, expect, it } from "vitest";
import {
  diffRequiredAgainstAccepted,
  type RequiredLegalDocument,
  type MyAcceptance,
} from "./legalGate";

// Note: savePendingLegalAcceptance/getPendingLegalAcceptance/clearPendingLegalAcceptance
// are thin localStorage wrappers, not covered here — this project's vitest config runs
// in the "node" environment (no jsdom), so `localStorage` isn't available in tests, the
// same reason the pre-existing client/lib/pendingOnboarding.ts and
// client/lib/referralCapture.ts localStorage helpers also have no unit tests.

const terms: RequiredLegalDocument = { document_id: "doc-1", document_type: "terms_and_conditions", title: "Terms", version: "1.0" };
const privacy: RequiredLegalDocument = { document_id: "doc-2", document_type: "privacy_policy", title: "Privacy", version: "1.0" };

describe("diffRequiredAgainstAccepted", () => {
  it("returns all required documents when nothing has been accepted", () => {
    const missing = diffRequiredAgainstAccepted([terms, privacy], []);
    expect(missing).toHaveLength(2);
  });

  it("returns empty when every required document is accepted at the current version", () => {
    const accepted: MyAcceptance[] = [
      { document_id: "doc-1", document_type: "terms_and_conditions", document_version: "1.0", accepted_at: "2026-01-01" },
      { document_id: "doc-2", document_type: "privacy_policy", document_version: "1.0", accepted_at: "2026-01-01" },
    ];
    expect(diffRequiredAgainstAccepted([terms, privacy], accepted)).toEqual([]);
  });

  it("flags a document as missing when the accepted version is outdated (re-acceptance case)", () => {
    const accepted: MyAcceptance[] = [
      { document_id: "doc-1-old", document_type: "terms_and_conditions", document_version: "0.9", accepted_at: "2025-01-01" },
      { document_id: "doc-2", document_type: "privacy_policy", document_version: "1.0", accepted_at: "2026-01-01" },
    ];
    const missing = diffRequiredAgainstAccepted([terms, privacy], accepted);
    expect(missing).toHaveLength(1);
    expect(missing[0].document_type).toBe("terms_and_conditions");
  });

  it("returns empty when nothing is required (enforcement effectively off)", () => {
    expect(diffRequiredAgainstAccepted([], [])).toEqual([]);
  });
});
