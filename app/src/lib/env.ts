import { Networks } from "@stellar/stellar-sdk";

/** Values safe to use in the browser. */
export const publicEnv = {
  network: (process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "testnet") as "testnet" | "mainnet",
  rpcUrl: process.env.NEXT_PUBLIC_STELLAR_RPC_URL ?? "https://soroban-testnet.stellar.org",
  contractId: process.env.NEXT_PUBLIC_CONTRACT_ID ?? "",
};

export const networkPassphrase =
  publicEnv.network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;

/** Read a required server-side variable, failing loudly if it's missing. */
export function serverEnv(name: "SUPABASE_URL" | "SUPABASE_SECRET_KEY" | "SESSION_SECRET"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}. See .env.example.`);
  }
  return value;
}
