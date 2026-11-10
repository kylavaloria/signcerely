import { describe, expect, it } from "vitest";
import { signedFileName } from "./file-name";

describe("signedFileName", () => {
  it("makes a clean name with no brackets or spaces", () => {
    expect(signedFileName("affidavit-template")).toBe("affidavit-template-signed.pdf");
    expect(signedFileName("Business Lease Agreement (Final)")).toBe("Business-Lease-Agreement-Final-signed.pdf");
  });
  it("drops a trailing .pdf, accents and odd symbols", () => {
    expect(signedFileName("Kontrata_2026.pdf")).toBe("Kontrata-2026-signed.pdf");
    expect(signedFileName("Résumé & Offer / v2")).toBe("Resume-Offer-v2-signed.pdf");
  });
  it("falls back when nothing usable is left", () => {
    expect(signedFileName("###")).toBe("document-signed.pdf");
  });
  it("keeps long titles short", () => {
    expect(signedFileName("a".repeat(200)).length).toBeLessThanOrEqual(92);
  });
});
