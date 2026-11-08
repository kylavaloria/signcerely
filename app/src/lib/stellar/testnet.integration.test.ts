/**
 * End-to-end against the real testnet contract. Skipped unless INTEGRATION=1
 * (runs in the "Testnet integration" GitHub workflow).
 *
 * Exercises exactly what the app does: build + check + submit `create`,
 * fetch `invite_message`, sign it with the invite secret, `sign` twice
 * (the last with the final fingerprint), and look the final copy up.
 */
import { createPrivateKey, randomBytes, sign as edSign } from "node:crypto";
import { Keypair, TransactionBuilder, type Transaction } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import { chainDocId, generateInviteKey } from "../invite-keys";
import {
  buildCreateTx,
  buildSignTx,
  chainConfigFromEnv,
  checkSignedCreate,
  findByHash,
  fundWithFriendbot,
  getChainDocument,
  inviteMessage,
  submitAndWait,
  type CreateArgs,
} from "./contract";

const run = process.env.INTEGRATION === "1";
const c = {
  ...chainConfigFromEnv(),
  contractId: process.env.NEXT_PUBLIC_CONTRACT_ID || "CBBZVOGZ7CSEQUW46OUMT3X7K22Q2GZYTRGOKJDTJIZTUGU36I24L3ZR",
};

function proof(secretHex: string, publicHex: string, msg: Buffer): string {
  const key = createPrivateKey({
    key: {
      kty: "OKP",
      crv: "Ed25519",
      d: Buffer.from(secretHex, "hex").toString("base64url"),
      x: Buffer.from(publicHex, "hex").toString("base64url"),
    },
    format: "jwk",
  });
  return edSign(null, msg, key).toString("hex");
}

function signXdr(xdrB64: string, kp: Keypair): Transaction {
  const tx = TransactionBuilder.fromXDR(xdrB64, c.networkPassphrase) as Transaction;
  tx.sign(kp);
  return tx;
}

describe.skipIf(!run)("testnet: full signing flow", () => {
  it(
    "creates, signs in order, completes, and finds the final copy",
    async () => {
      const sender = Keypair.random();
      const ana = Keypair.random();
      const jomar = Keypair.random();
      await Promise.all([sender, ana, jomar].map((k) => fundWithFriendbot(c, k.publicKey())));

      const keys = [generateInviteKey(), generateInviteKey()];
      const docId = chainDocId(crypto.randomUUID());
      const original = randomBytes(32).toString("hex");
      const finalHash = randomBytes(32).toString("hex");
      const args: CreateArgs = {
        sender: sender.publicKey(),
        chainDocId: docId,
        originalHash: original,
        inviteKeys: keys.map((k) => k.publicKeyHex),
        inOrder: true,
      };

      // Send
      const unsigned = await buildCreateTx(c, args);
      const signedCreate = signXdr(unsigned, sender);
      const checked = checkSignedCreate(c, signedCreate.toXDR(), args);
      const created = await submitAndWait(c, checked);
      console.log("create tx", created.hash);

      const doc = await getChainDocument(c, docId);
      expect(doc.signed_count).toBe(0);

      // Ana signs slot 0 with her invite proof
      const msgA = await inviteMessage(c, docId, 0, ana.publicKey());
      const signA = await buildSignTx(c, {
        signer: ana.publicKey(),
        chainDocId: docId,
        slot: 0,
        inviteProof: proof(keys[0].secretHex, keys[0].publicKeyHex, msgA),
        imageHash: randomBytes(32).toString("hex"),
        finalHash: null,
      });
      console.log("sign tx (Ana)", (await submitAndWait(c, signXdr(signA, ana))).hash);

      // Jomar signs last, adding the final fingerprint
      const msgJ = await inviteMessage(c, docId, 1, jomar.publicKey());
      const signJ = await buildSignTx(c, {
        signer: jomar.publicKey(),
        chainDocId: docId,
        slot: 1,
        inviteProof: proof(keys[1].secretHex, keys[1].publicKeyHex, msgJ),
        imageHash: randomBytes(32).toString("hex"),
        finalHash,
      });
      console.log("sign tx (Jomar)", (await submitAndWait(c, signXdr(signJ, jomar))).hash);

      const done = await getChainDocument(c, docId);
      expect(done.signed_count).toBe(2);
      expect(Buffer.from(done.final_hash as Uint8Array).toString("hex")).toBe(finalHash);
      const found = (await findByHash(c, finalHash)) as unknown[];
      expect(found[0]).toBe("Final");
      expect(Buffer.from(found[1] as Uint8Array).toString("hex")).toBe(docId);
    },
    180_000,
  );

  it(
    "rejects a proof made for a different wallet",
    async () => {
      const sender = Keypair.random();
      const invitee = Keypair.random();
      const thief = Keypair.random();
      await Promise.all([sender, invitee, thief].map((k) => fundWithFriendbot(c, k.publicKey())));
      const keys = [generateInviteKey(), generateInviteKey()];
      const docId = chainDocId(crypto.randomUUID());
      const args: CreateArgs = {
        sender: sender.publicKey(),
        chainDocId: docId,
        originalHash: randomBytes(32).toString("hex"),
        inviteKeys: keys.map((k) => k.publicKeyHex),
        inOrder: false,
      };
      await submitAndWait(c, checkSignedCreate(c, signXdr(await buildCreateTx(c, args), sender).toXDR(), args));

      const msgForInvitee = await inviteMessage(c, docId, 0, invitee.publicKey());
      const stolenProof = proof(keys[0].secretHex, keys[0].publicKeyHex, msgForInvitee);
      await expect(
        buildSignTx(c, {
          signer: thief.publicKey(),
          chainDocId: docId,
          slot: 0,
          inviteProof: stolenProof,
          imageHash: randomBytes(32).toString("hex"),
          finalHash: null,
        }),
      ).rejects.toThrow();
    },
    120_000,
  );
});
