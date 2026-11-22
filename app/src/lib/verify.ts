import "server-only";
import { formatSignedDate } from "./final-pdf";
import { chainConfigFromEnv, findByHash, getChainDocument, getChainSignatures } from "./stellar/contract";
import { db } from "./supabase";

/**
 * Public verification. The source of truth is the contract on Stellar; the
 * app's database only adds human-friendly names and titles.
 */

export type VerifiedSigner = {
  slot: number;
  name: string;
  wallet: string | null;
  signedLabel: string | null;
  txHash: string | null;
  status: "signed" | "declined" | "waiting";
};

export type VerifiedRecord = {
  chainDocId: string;
  title: string;
  senderName: string | null;
  status: "pending" | "completed" | "declined" | "cancelled";
  sentLabel: string | null;
  completedLabel: string | null;
  originalHash: string;
  finalHash: string | null;
  createTx: string | null;
  signers: VerifiedSigner[];
};

export type VerifyResult =
  | { kind: "final" | "original"; fileHash: string; record: VerifiedRecord }
  | { kind: "none"; fileHash: string }
  | { kind: "error"; message: string };

const STATUS = ["pending", "completed", "declined", "cancelled"] as const;
const hex = (b: unknown) => (b instanceof Uint8Array ? Buffer.from(b).toString("hex") : typeof b === "string" ? b : "");
const at = (secs: unknown) => (secs == null ? null : formatSignedDate(new Date(Number(secs) * 1000)));

/** Everything public about one on-chain document. Null if it isn't on the contract. */
export async function loadRecord(chainDocId: string): Promise<VerifiedRecord | null> {
  if (!/^[0-9a-f]{64}$/.test(chainDocId)) return null;
  const c = chainConfigFromEnv();
  // The on-chain document, its signatures and our off-chain names are independent: fetch them together.
  const [chain, sigs, { data: docRow }] = await Promise.all([
    getChainDocument(c, chainDocId).then(
      (d) => ({ ok: true as const, d }),
      (e: unknown) => ({ ok: false as const, e }),
    ),
    getChainSignatures(c, chainDocId).catch(() => [] as Awaited<ReturnType<typeof getChainSignatures>>),
    db()
      .from("documents")
      .select("id, title, create_tx_hash, profiles(full_name), document_signers(slot, invited_name, status, sign_tx_hash, wallet_address)")
      .eq("chain_doc_id", chainDocId)
      .maybeSingle(),
  ]);
  if (!chain.ok) {
    const e = chain.e;
    // Contract error #2 = no such document. Anything else is the network being
    // unreachable, which must not be shown as "not found".
    if (/Error\(Contract, #2\)/.test(e instanceof Error ? e.message : String(e))) return null;
    throw new Error("Couldn’t reach the Stellar network to load this record.", { cause: e });
  }
  const chainDoc = chain.d;
  const { document_signers: rows, ...doc } = (docRow ?? { document_signers: [] }) as {
    id?: string;
    title?: string;
    create_tx_hash?: string | null;
    profiles?: unknown;
    document_signers: { slot: number; invited_name: string; status: string; sign_tx_hash: string | null; wallet_address: string | null }[];
  };
  const wallets = sigs.filter(Boolean).map((s) => s!.signer);
  const { data: names } = wallets.length
    ? await db().from("profiles").select("wallet_address, full_name").in("wallet_address", wallets)
    : { data: [] };

  const keys = (chainDoc.invite_keys as unknown[]) ?? [];
  const signers: VerifiedSigner[] = keys.map((_, slot) => {
    const s = sigs[slot] ?? null;
    const row = rows?.find((r) => r.slot === slot);
    const wallet = s?.signer ?? row?.wallet_address ?? null;
    return {
      slot,
      name: names?.find((n) => n.wallet_address === wallet)?.full_name ?? row?.invited_name ?? `Signer ${slot + 1}`,
      wallet,
      signedLabel: s ? at(s.signed_at) : null,
      txHash: s ? (row?.sign_tx_hash ?? null) : null,
      status: s ? "signed" : row?.status === "declined" ? "declined" : "waiting",
    };
  });

  return {
    chainDocId,
    title: doc?.title ?? "Document recorded on Stellar",
    senderName: (doc?.profiles as unknown as { full_name: string } | null)?.full_name ?? null,
    status: STATUS[Number(chainDoc.status)] ?? "pending",
    sentLabel: at(chainDoc.created_at),
    completedLabel: at(chainDoc.completed_at),
    originalHash: hex(chainDoc.original_hash),
    finalHash: chainDoc.final_hash ? hex(chainDoc.final_hash) : null,
    createTx: doc?.create_tx_hash ?? null,
    signers,
  };
}

/** Look up a file fingerprint on the contract. */
export async function verifyFingerprint(fileHash: string): Promise<VerifyResult> {
  if (!/^[0-9a-f]{64}$/.test(fileHash)) return { kind: "error", message: "That doesn’t look like a file fingerprint." };
  let found: unknown;
  try {
    found = await findByHash(chainConfigFromEnv(), fileHash);
  } catch (e) {
    console.error("find_by_hash failed", e);
    return { kind: "error", message: "We couldn’t reach the Stellar network. Try again in a moment." };
  }
  const tag = Array.isArray(found) ? found[0] : found;
  if (tag !== "Final" && tag !== "Original") return { kind: "none", fileHash };
  let record: VerifiedRecord | null;
  try {
    record = await loadRecord(hex((found as unknown[])[1]));
  } catch (e) {
    console.error("load record failed", e);
    return { kind: "error", message: "We couldn’t reach the Stellar network. Try again in a moment." };
  }
  if (!record) return { kind: "none", fileHash };
  return { kind: tag === "Final" ? "final" : "original", fileHash, record };
}
