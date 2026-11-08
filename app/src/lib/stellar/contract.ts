import {
  Account,
  Address,
  Contract,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
  rpc,
  scValToNative,
  xdr,
  type Transaction,
} from "@stellar/stellar-sdk";

/**
 * Talks to the It's Your Sign Soroban contract (contracts/signing).
 * No Next.js imports, so the same code runs in the app server and in the
 * testnet integration test.
 */

export type ChainConfig = { rpcUrl: string; contractId: string; networkPassphrase: string };

export function chainConfigFromEnv(): ChainConfig {
  const network = process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "testnet";
  return {
    rpcUrl: process.env.NEXT_PUBLIC_STELLAR_RPC_URL ?? "https://soroban-testnet.stellar.org",
    contractId: process.env.NEXT_PUBLIC_CONTRACT_ID ?? "",
    networkPassphrase: network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET,
  };
}

export const server = (c: ChainConfig) => new rpc.Server(c.rpcUrl, { allowHttp: c.rpcUrl.startsWith("http://") });

const bytes = (hex: string) => xdr.ScVal.scvBytes(Buffer.from(hex, "hex"));

/** Contract error numbers (see contracts/signing/src/lib.rs) → plain words. */
export const CONTRACT_ERRORS: Record<number, string> = {
  1: "This document was already sent.",
  2: "This document isn’t on the network.",
  3: "A document needs 2 to 5 signers.",
  4: "Two signers ended up with the same invite. Edit the signers and try again.",
  5: "That signing spot doesn’t exist.",
  6: "This spot has already been signed.",
  7: "It isn’t your turn to sign yet.",
  8: "This document is no longer waiting for signatures.",
  9: "The final copy’s fingerprint is missing.",
  10: "Only the last signer adds the final copy’s fingerprint.",
  11: "Only the sender can do this.",
  12: "This exact file is already registered. Upload a different version.",
  13: "This wallet already signed this document for someone else.",
};

/** Turn RPC/simulation errors into something a person can act on. */
export function explainChainError(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e);
  const code = msg.match(/Error\(Contract, #(\d+)\)/);
  if (code && CONTRACT_ERRORS[Number(code[1])]) return CONTRACT_ERRORS[Number(code[1])];
  if (/Account not found/i.test(msg)) return "NO_ACCOUNT";
  if (/insufficient|underfunded|balance/i.test(msg)) return "Your wallet doesn’t have enough XLM for the network fee.";
  return "The network rejected the request. Please try again.";
}

// ---------- create ----------

export type CreateArgs = {
  sender: string;
  chainDocId: string; // hex, 32 bytes
  originalHash: string; // hex, 32 bytes
  inviteKeys: string[]; // hex, 32 bytes each, in slot order
  inOrder: boolean;
};

function createScArgs(a: CreateArgs): xdr.ScVal[] {
  return [
    new Address(a.sender).toScVal(),
    bytes(a.chainDocId),
    bytes(a.originalHash),
    xdr.ScVal.scvVec(a.inviteKeys.map(bytes)),
    xdr.ScVal.scvBool(a.inOrder),
  ];
}

/** Build and simulate `create`; returns the transaction XDR for the sender's wallet to sign. */
export async function buildCreateTx(c: ChainConfig, a: CreateArgs): Promise<string> {
  const s = server(c);
  const account = await s.getAccount(a.sender);
  const tx = new TransactionBuilder(account, { fee: "100000", networkPassphrase: c.networkPassphrase })
    .addOperation(new Contract(c.contractId).call("create", ...createScArgs(a)))
    .setTimeout(300)
    .build();
  return (await s.prepareTransaction(tx)).toXDR();
}

/**
 * Check that a wallet-signed transaction is exactly the `create` call we
 * built for this document (same source, contract, function and arguments),
 * so a tampered transaction can't mark the document as sent.
 */
export function checkSignedCreate(c: ChainConfig, signedXdr: string, a: CreateArgs): Transaction {
  return checkSignedCall(c, signedXdr, a.sender, "create", createScArgs(a));
}

/**
 * Check that a wallet-signed transaction is exactly the contract call we
 * built (same source account, contract, function and arguments).
 */
export function checkSignedCall(
  c: ChainConfig,
  signedXdr: string,
  source: string,
  fn: string,
  args: xdr.ScVal[],
): Transaction {
  const mismatch = () => new Error("Signed transaction doesn’t match this document.");
  const tx = TransactionBuilder.fromXDR(signedXdr, c.networkPassphrase) as Transaction;
  if (!("operations" in tx) || tx.source !== source || tx.operations.length !== 1) throw mismatch();
  const op = tx.operations[0] as Operation.InvokeHostFunction;
  if (op.type !== "invokeHostFunction" || op.func.type !== "hostFunctionTypeInvokeContract") throw mismatch();
  const call = op.func.invokeContract;
  const same =
    Address.fromScAddress(call.contractAddress).toString() === c.contractId &&
    call.functionName.toString() === fn &&
    xdr.ScVal.scvVec(call.args).equals(xdr.ScVal.scvVec(args));
  if (!same) throw mismatch();
  if (tx.signatures.length === 0) throw new Error("The transaction wasn’t signed.");
  return tx;
}

// ---------- sign ----------

export type SignArgs = {
  signer: string;
  chainDocId: string;
  slot: number;
  inviteProof: string; // hex, 64-byte ed25519 signature over invite_message
  imageHash: string; // hex, 32 bytes
  finalHash: string | null; // hex, required on the last signature only
};

export function signScArgs(a: SignArgs): xdr.ScVal[] {
  return [
    new Address(a.signer).toScVal(),
    bytes(a.chainDocId),
    xdr.ScVal.scvU32(a.slot),
    bytes(a.inviteProof),
    bytes(a.imageHash),
    a.finalHash ? bytes(a.finalHash) : xdr.ScVal.scvVoid(),
  ];
}

/** Build and simulate `sign`; returns XDR for the signer's wallet to sign. */
export function checkSignedSign(c: ChainConfig, signedXdr: string, a: SignArgs): Transaction {
  return checkSignedCall(c, signedXdr, a.signer, "sign", signScArgs(a));
}

export async function buildSignTx(c: ChainConfig, a: SignArgs): Promise<string> {
  const s = server(c);
  const account = await s.getAccount(a.signer);
  const tx = new TransactionBuilder(account, { fee: "100000", networkPassphrase: c.networkPassphrase })
    .addOperation(new Contract(c.contractId).call("sign", ...signScArgs(a)))
    .setTimeout(300)
    .build();
  return (await s.prepareTransaction(tx)).toXDR();
}

// ---------- submit ----------

export type Submitted = { hash: string; ledger: number; returnValue?: unknown };

/** Send a signed transaction and wait (up to ~40s) for the result. */
export async function submitAndWait(c: ChainConfig, tx: Transaction): Promise<Submitted> {
  const s = server(c);
  const sent = await s.sendTransaction(tx);
  if (sent.status === "ERROR") {
    throw new Error(`Transaction rejected: ${sent.errorResult?.result.type ?? "unknown"}`);
  }
  if (sent.status === "TRY_AGAIN_LATER") throw new Error("The network is busy. Please try again in a moment.");
  const final = await s.pollTransaction(sent.hash, { attempts: 20, sleepStrategy: () => 2000 });
  if (final.status === rpc.Api.GetTransactionStatus.SUCCESS) {
    return {
      hash: sent.hash,
      ledger: final.ledger,
      returnValue: final.returnValue ? scValToNative(final.returnValue) : undefined,
    };
  }
  if (final.status === rpc.Api.GetTransactionStatus.FAILED) {
    throw new Error(`Transaction ${sent.hash} failed on the network.`);
  }
  throw new Error(`Still waiting for the network to confirm ${sent.hash}. Refresh in a minute.`);
}

// ---------- read-only calls ----------

async function readCall(c: ChainConfig, fn: string, args: xdr.ScVal[]): Promise<xdr.ScVal> {
  const s = server(c);
  // Any funded or unfunded account works as the source of a simulation.
  const source = new Account(Keypair.random().publicKey(), "0");
  const tx = new TransactionBuilder(source, { fee: "100", networkPassphrase: c.networkPassphrase })
    .addOperation(new Contract(c.contractId).call(fn, ...args))
    .setTimeout(30)
    .build();
  const sim = await s.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error);
  if (!sim.result) throw new Error(`No result from ${fn}`);
  return sim.result.retval;
}

/** The exact bytes an invite proof must sign (contract `invite_message`). */
export async function inviteMessage(c: ChainConfig, chainDocId: string, slot: number, signer: string): Promise<Buffer> {
  const v = await readCall(c, "invite_message", [bytes(chainDocId), xdr.ScVal.scvU32(slot), new Address(signer).toScVal()]);
  if (v.type !== "scvBytes") throw new Error("invite_message returned an unexpected value");
  return Buffer.from(v.bytes.toBytes());
}

export async function getChainDocument(c: ChainConfig, chainDocId: string): Promise<Record<string, unknown>> {
  return scValToNative(await readCall(c, "get_document", [bytes(chainDocId)]));
}

export async function findByHash(c: ChainConfig, hashHex: string): Promise<unknown> {
  return scValToNative(await readCall(c, "find_by_hash", [bytes(hashHex)]));
}

/** Testnet only: create/fund an account with Friendbot. */
export async function fundWithFriendbot(c: ChainConfig, address: string): Promise<void> {
  if (c.networkPassphrase !== Networks.TESTNET) throw new Error("Free XLM is only available on testnet.");
  const res = await fetch(`https://friendbot.stellar.org/?addr=${encodeURIComponent(address)}`);
  if (!res.ok) {
    const body = await res.text();
    if (/already funded|op_already_exists|createAccountAlreadyExist/i.test(body)) return;
    throw new Error("Friendbot couldn’t fund this wallet right now. Try again in a minute.");
  }
}

export async function xlmBalance(c: ChainConfig, address: string): Promise<number | null> {
  try {
    const res = await fetch(
      `${c.networkPassphrase === Networks.TESTNET ? "https://horizon-testnet.stellar.org" : "https://horizon.stellar.org"}/accounts/${address}`,
    );
    if (res.status === 404) return null;
    const j = (await res.json()) as { balances: { asset_type: string; balance: string }[] };
    return Number(j.balances.find((b) => b.asset_type === "native")?.balance ?? 0);
  } catch {
    return null;
  }
}
