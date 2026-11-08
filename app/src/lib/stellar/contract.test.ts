import { describe, expect, it } from "vitest";
import { Account, Address, Contract, Keypair, Networks, TransactionBuilder, xdr } from "@stellar/stellar-sdk";
import { checkSignedCreate, explainChainError, type CreateArgs } from "./contract";

const c = {
  rpcUrl: "https://example.invalid",
  contractId: "CBBZVOGZ7CSEQUW46OUMT3X7K22Q2GZYTRGOKJDTJIZTUGU36I24L3ZR",
  networkPassphrase: Networks.TESTNET,
};
const sender = Keypair.random();
const args: CreateArgs = {
  sender: sender.publicKey(),
  chainDocId: "11".repeat(32),
  originalHash: "22".repeat(32),
  inviteKeys: ["aa".repeat(32), "bb".repeat(32)],
  inOrder: true,
};
const b = (h: string) => xdr.ScVal.scvBytes(Buffer.from(h, "hex"));

function signedCreate(a: CreateArgs, opts: { fn?: string; contract?: string; source?: Keypair } = {}) {
  const src = opts.source ?? sender;
  const tx = new TransactionBuilder(new Account(src.publicKey(), "1"), { fee: "100", networkPassphrase: c.networkPassphrase })
    .addOperation(
      new Contract(opts.contract ?? c.contractId).call(
        opts.fn ?? "create",
        new Address(a.sender).toScVal(),
        b(a.chainDocId),
        b(a.originalHash),
        xdr.ScVal.scvVec(a.inviteKeys.map(b)),
        xdr.ScVal.scvBool(a.inOrder),
      ),
    )
    .setTimeout(300)
    .build();
  tx.sign(src);
  return tx.toXDR();
}

describe("checkSignedCreate", () => {
  it("accepts the exact create call for this document", () => {
    expect(() => checkSignedCreate(c, signedCreate(args), args)).not.toThrow();
  });
  it("rejects different arguments (e.g. swapped signing order)", () => {
    expect(() => checkSignedCreate(c, signedCreate({ ...args, inOrder: false }), args)).toThrow();
    expect(() => checkSignedCreate(c, signedCreate({ ...args, inviteKeys: ["cc".repeat(32), "bb".repeat(32)] }), args)).toThrow();
  });
  it("rejects another function, contract or source account", () => {
    expect(() => checkSignedCreate(c, signedCreate(args, { fn: "cancel" }), args)).toThrow();
    expect(() =>
      checkSignedCreate(c, signedCreate(args, { contract: "CCG4G2T6F7K2PVGSGRTRSTB4GSMLB4GLMULEMODGYI74MOWMTNZ5RZMP" }), args),
    ).toThrow();
    expect(() => checkSignedCreate(c, signedCreate(args, { source: Keypair.random() }), args)).toThrow();
  });
});

describe("explainChainError", () => {
  it("maps contract error numbers to plain words", () => {
    expect(explainChainError(new Error("HostError: Error(Contract, #12)"))).toMatch(/already registered/);
    expect(explainChainError(new Error("Error(Contract, #7)"))).toMatch(/turn/);
  });
  it("flags a missing account so the app can offer free test XLM", () => {
    expect(explainChainError(new Error("Account not found: GABC"))).toBe("NO_ACCOUNT");
  });
});
