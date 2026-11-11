import { describe, expect, it } from "vitest";
import { decideAccess, maskEmail } from "./signer-identity";

const base = {
  wallet: "GNICOLE",
  slotWallet: null,
  invitedEmail: "kyla@example.com",
  profileEmail: "nicole@example.com",
  emailConfirmed: true,
  isSender: false,
  byLink: false,
};

describe("decideAccess", () => {
  it("lets the invited person sign with the link", () => {
    const d = decideAccess({ ...base, profileEmail: "Kyla@Example.com", emailConfirmed: false, byLink: true });
    expect(d).toEqual({ invited: true, canSign: true, wrongAccount: false });
  });

  it("lets the invited person sign with a confirmed email and no link", () => {
    expect(decideAccess({ ...base, profileEmail: "kyla@example.com" }).canSign).toBe(true);
  });

  it("does not let a different signed-in account sign just because it holds the link", () => {
    const d = decideAccess({ ...base, byLink: true });
    expect(d).toEqual({ invited: true, canSign: false, wrongAccount: true });
  });

  it("does not let the sender sign someone else's slot with a copied link", () => {
    expect(decideAccess({ ...base, isSender: true, byLink: true }).canSign).toBe(false);
  });

  it("does not trust an unconfirmed matching email without the link", () => {
    const d = decideAccess({ ...base, profileEmail: "kyla@example.com", emailConfirmed: false });
    expect(d.canSign).toBe(false);
    expect(d.invited).toBe(false);
  });

  it("keeps a slot with the wallet that already holds it", () => {
    expect(decideAccess({ ...base, slotWallet: "GNICOLE" }).canSign).toBe(true);
  });

  it("needs a signed-in wallet", () => {
    expect(decideAccess({ ...base, wallet: null, profileEmail: "kyla@example.com", byLink: true }).canSign).toBe(false);
  });
});

describe("maskEmail", () => {
  it("hides most of the name", () => {
    expect(maskEmail("kyla@example.com")).toBe("k•••@example.com");
  });
});
