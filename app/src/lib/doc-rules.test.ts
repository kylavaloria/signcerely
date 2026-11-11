import { describe, expect, it } from "vitest";
import { fieldsSchema, MAX_SIGNERS, signersSchema } from "./doc-rules";

const s = (name: string, email: string) => ({ name, email });

describe("signer rules", () => {
  it("accepts a valid signer list and normalizes email case", () => {
    const r = signersSchema.parse({ inOrder: true, signers: [s("Ana", "Ana@X.com "), s("Jo", "jo@x.com")] });
    expect(r.signers[0].email).toBe("ana@x.com");
  });

  it("rejects too few or too many", () => {
    expect(signersSchema.safeParse({ inOrder: true, signers: [s("A", "a@x.com")] }).success).toBe(false);
    const many = (n: number) => Array.from({ length: n }, (_, i) => s(`P${i}`, `p${i}@x.com`));
    expect(signersSchema.safeParse({ inOrder: true, signers: many(MAX_SIGNERS) }).success).toBe(true);
    expect(signersSchema.safeParse({ inOrder: true, signers: many(MAX_SIGNERS + 1) }).success).toBe(false);
  });

  it("points at the duplicate email", () => {
    const r = signersSchema.safeParse({ inOrder: false, signers: [s("A", "a@x.com"), s("B", "A@x.com")] });
    expect(r.success).toBe(false);
    expect(r.error!.issues[0].path).toEqual(["signers", 1, "email"]);
  });

  it("requires names and valid emails", () => {
    expect(signersSchema.safeParse({ inOrder: true, signers: [s("", "a@x.com"), s("B", "b@x.com")] }).success).toBe(false);
    expect(signersSchema.safeParse({ inOrder: true, signers: [s("A", "nope"), s("B", "b@x.com")] }).success).toBe(false);
  });
});

describe("signature box rules", () => {
  const id = "3f1e2c4a-1b2c-4d3e-8f90-a1b2c3d4e5f6";
  it("accepts a box on the page", () => {
    expect(fieldsSchema.safeParse([{ signerId: id, page: 2, x: 0.6, y: 0.8, width: 0.3, height: 0.085 }]).success).toBe(true);
  });
  it("rejects a box hanging off the page", () => {
    expect(fieldsSchema.safeParse([{ signerId: id, page: 1, x: 0.8, y: 0.5, width: 0.3, height: 0.08 }]).success).toBe(false);
  });
});
