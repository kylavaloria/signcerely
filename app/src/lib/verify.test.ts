import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const chain = vi.hoisted(() => ({
  findByHash: vi.fn(),
  getChainDocument: vi.fn(),
  getChainSignatures: vi.fn(),
}));
vi.mock("./stellar/contract", () => ({ chainConfigFromEnv: () => ({}), ...chain }));

// Off-chain names, as the database would return them.
const rows = vi.hoisted(() => ({ doc: null as unknown, profiles: [] as unknown[] }));
vi.mock("./supabase", () => ({
  db: () => ({
    from: (table: string) => {
      const q = {
        select: () => q,
        eq: () => q,
        in: () => Promise.resolve({ data: table === "profiles" ? rows.profiles : [] }),
        maybeSingle: () => Promise.resolve({ data: table === "documents" ? rows.doc : null }),
      };
      return q;
    },
  }),
}));

import { loadRecord, verifyFingerprint } from "./verify";

const FILE = "ab".repeat(32);
const DOC_ID = "cd".repeat(32);
const bytes = (hex: string) => Uint8Array.from(Buffer.from(hex, "hex"));
const WALLET_A = "GA".padEnd(56, "A");

function chainDoc(status: number) {
  return {
    status,
    invite_keys: [bytes("01".repeat(32)), bytes("02".repeat(32))],
    created_at: 1_762_560_000,
    completed_at: status === 1 ? 1_762_563_600 : null,
    original_hash: bytes("ee".repeat(32)),
    final_hash: status === 1 ? bytes(FILE) : null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  rows.doc = null;
  rows.profiles = [];
});

describe("verifyFingerprint", () => {
  it("rejects something that isn't a fingerprint without calling Stellar", async () => {
    expect(await verifyFingerprint("not-a-hash")).toEqual({ kind: "error", message: expect.any(String) });
    expect(chain.findByHash).not.toHaveBeenCalled();
  });

  it("says no match when the fingerprint isn't on the contract", async () => {
    chain.findByHash.mockResolvedValue(["None"]);
    expect(await verifyFingerprint(FILE)).toEqual({ kind: "none", fileHash: FILE });
  });

  it("reports a network problem instead of 'no match' when Stellar can't be reached", async () => {
    chain.findByHash.mockRejectedValue(new Error("fetch failed"));
    const r = await verifyFingerprint(FILE);
    expect(r.kind).toBe("error");
  });

  it("identifies the final signed copy with signer names, times and the sender", async () => {
    chain.findByHash.mockResolvedValue(["Final", bytes(DOC_ID)]);
    chain.getChainDocument.mockResolvedValue(chainDoc(1));
    chain.getChainSignatures.mockResolvedValue([
      { signer: WALLET_A, signed_at: 1_762_560_600 },
      { signer: "GB".padEnd(56, "B"), signed_at: 1_762_563_600 },
    ]);
    rows.doc = {
      title: "Lease",
      create_tx_hash: "tx-create",
      profiles: { full_name: "Alice Sender" },
      document_signers: [
        { slot: 0, invited_name: "Bob", status: "signed", sign_tx_hash: "tx-0", wallet_address: WALLET_A },
        { slot: 1, invited_name: "Carol", status: "signed", sign_tx_hash: "tx-1", wallet_address: null },
      ],
    };
    rows.profiles = [{ wallet_address: WALLET_A, full_name: "Bob Reyes" }];

    const r = await verifyFingerprint(FILE);
    expect(r.kind).toBe("final");
    if (r.kind !== "final") return;
    expect(r.record).toMatchObject({
      chainDocId: DOC_ID,
      title: "Lease",
      senderName: "Alice Sender",
      status: "completed",
      finalHash: FILE,
      originalHash: "ee".repeat(32),
      createTx: "tx-create",
    });
    // The profile name wins over the name typed by the sender.
    expect(r.record.signers.map((s) => [s.name, s.status, s.txHash])).toEqual([
      ["Bob Reyes", "signed", "tx-0"],
      ["Carol", "signed", "tx-1"],
    ]);
  });

  it("identifies the original file that was sent for signing", async () => {
    chain.findByHash.mockResolvedValue(["Original", bytes(DOC_ID)]);
    chain.getChainDocument.mockResolvedValue(chainDoc(0));
    chain.getChainSignatures.mockResolvedValue([null, null]);
    const r = await verifyFingerprint(FILE);
    expect(r.kind).toBe("original");
    if (r.kind !== "original") return;
    expect(r.record.status).toBe("pending");
    expect(r.record.finalHash).toBeNull();
  });
});

describe("loadRecord", () => {
  it("returns nothing for a malformed id or a document the contract doesn't have", async () => {
    expect(await loadRecord("xyz")).toBeNull();
    chain.getChainDocument.mockRejectedValue(new Error("HostError: Error(Contract, #2)"));
    chain.getChainSignatures.mockResolvedValue([]);
    expect(await loadRecord(DOC_ID)).toBeNull();
  });

  it("throws on network errors so they're never shown as 'not found'", async () => {
    chain.getChainDocument.mockRejectedValue(new Error("fetch failed"));
    chain.getChainSignatures.mockResolvedValue([]);
    await expect(loadRecord(DOC_ID)).rejects.toThrow(/Stellar network/);
  });

  it("falls back to generic names when the app has no record of the document", async () => {
    chain.getChainDocument.mockResolvedValue(chainDoc(2));
    chain.getChainSignatures.mockResolvedValue([null, null]);
    const r = await loadRecord(DOC_ID);
    expect(r?.title).toBe("Document recorded on Stellar");
    expect(r?.status).toBe("declined");
    expect(r?.signers.map((s) => [s.name, s.status])).toEqual([
      ["Signer 1", "waiting"],
      ["Signer 2", "waiting"],
    ]);
  });

  it("marks a slot the app recorded as declined", async () => {
    chain.getChainDocument.mockResolvedValue(chainDoc(2));
    chain.getChainSignatures.mockResolvedValue([null, null]);
    rows.doc = {
      title: "Offer",
      document_signers: [
        { slot: 0, invited_name: "Bob", status: "declined", sign_tx_hash: null, wallet_address: null },
        { slot: 1, invited_name: "Carol", status: "invited", sign_tx_hash: null, wallet_address: null },
      ],
    };
    const r = await loadRecord(DOC_ID);
    expect(r?.signers.map((s) => s.status)).toEqual(["declined", "waiting"]);
  });
});
