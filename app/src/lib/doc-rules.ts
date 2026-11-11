import { z } from "zod";

/** Limits and validation shared by the browser and the server. */

export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const MIN_SIGNERS = 2;
export const MAX_SIGNERS = 20; // must match the contract

/** Default signature box size, as a fraction of the page (includes the date line). */
export const BOX_WIDTH = 0.3;
export const BOX_HEIGHT = 0.085;

export const draftInfoSchema = z.object({
  title: z.string().trim().min(1, "Give the document a title.").max(200, "Keep the title under 200 characters."),
  summary: z.string().trim().max(300, "Keep the summary under 300 characters.").optional().default(""),
  pageCount: z.number().int().min(1).max(500),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  size: z.number().int().min(1).max(MAX_PDF_BYTES, "PDFs can be up to 10 MB."),
});

const signerSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(120, "Keep names under 120 characters."),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email.")),
});

export const signersSchema = z
  .object({
    inOrder: z.boolean(),
    signers: z
      .array(signerSchema)
      .min(MIN_SIGNERS, `Add at least ${MIN_SIGNERS} signers.`)
      .max(MAX_SIGNERS, `You can add up to ${MAX_SIGNERS} signers.`),
  })
  .superRefine((v, ctx) => {
    const seen = new Map<string, number>();
    v.signers.forEach((s, i) => {
      const prev = seen.get(s.email);
      if (prev !== undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["signers", i, "email"],
          message: `Same email as signer ${prev + 1}. Each person needs their own email.`,
        });
      } else {
        seen.set(s.email, i);
      }
    });
  });

export type SignersInput = z.input<typeof signersSchema>;

const frac = z.number().min(0).max(1);
export const fieldsSchema = z
  .array(
    z
      .object({
        signerId: z.uuid(),
        page: z.number().int().min(1),
        x: frac,
        y: frac,
        width: z.number().gt(0).max(1),
        height: z.number().gt(0).max(1),
      })
      .refine((f) => f.x + f.width <= 1.0001 && f.y + f.height <= 1.0001, "Box goes off the page."),
  )
  .max(100);

export type FieldInput = z.infer<typeof fieldsSchema>[number];

/** Distinct colors per signing slot (on white, AA contrast for the label text). */
export const SIGNER_COLORS = [
  { solid: "#1F3FBF", tint: "rgba(31,63,191,.08)" },
  { solid: "#0B7A75", tint: "rgba(11,122,117,.08)" },
  { solid: "#8A3FB8", tint: "rgba(138,63,184,.08)" },
  { solid: "#B4531A", tint: "rgba(180,83,26,.08)" },
  { solid: "#3A6E1F", tint: "rgba(58,110,31,.08)" },
];

export function prettyBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
