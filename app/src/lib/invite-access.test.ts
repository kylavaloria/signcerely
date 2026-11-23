import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateInviteKey } from "./invite-keys";

vi.mock("server-only", () => ({}));
vi.mock("./env", () => ({ serverEnv: () => "test-session-secret-that-is-long-enough" }));

// This browser's cookies.
const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
  }),
}));

// Who is signed in, and their profile.
const who = vi.hoisted(() => ({ wallet: null as string | null, profile: null as unknown }));
vi.mock("./session", () => ({ getSession: async () => (who.wallet ? { wallet: who.wallet } : null) }));
vi.mock("./profile", () => ({ getProfile: async () => who.profile }));

// A small stand-in for the database: one invite slot and its document.
const store = vi.hoisted(() => ({
  slot: null as Record<string, unknown> | null,
  updates: [] as unknown[],
  events: [] as unknown[],
}));
vi.mock("./supabase", () => ({
  db: () => ({
    from: (table: string) => {
      let update: Record<string, unknown> | null = null;
      const q = {
        select: () => q,
        eq: () => q,
        update: (v: Record<string, unknown>) => ((update = v), q),
        insert: (v: unknown) => (store.events.push(v), Promise.resolve({ data: null })),
        maybeSingle: () => Promise.resolve({ data: table === "document_signers" ? store.slot : null }),
        // update(...).eq(...).eq(...).select() resolves with the changed rows.
        then: (resolve: (r: unknown) => void) => {
          if (update && store.slot && store.slot.status === "invited") {
            store.updates.push(update);
            store.slot = { ...store.slot, ...update };
            return resolve({ data: [{ id: store.slot.id }] });
          }
          return resolve({ data: [] });
        },
      };
      return q;
    },
  }),
}));

import { getAccess, recordView, unlockWithKey, unlockedInvitePrefill } from "./invite-access";

const SIGNER_ID = "11111111-2222-3333-4444-555555555555";
const SENDER = "GSENDER".padEnd(56, "S");
const BOB = "GBOB".padEnd(56, "B");
const MALLORY = "GMAL".padEnd(56, "M");
const invite = generateInviteKey();

function seed(over: Record<string, unknown> = {}, docOver: Record<string, unknown> = {}) {
  store.slot = {
    id: SIGNER_ID,
    document_id: "doc-1",
    slot: 0,
    invited_name: "Bob",
    invited_email: "bob@example.com",
    invite_public_key: invite.publicKeyHex,
    wallet_address: null,
    status: "invited",
    documents: { id: "doc-1", sender_wallet: SENDER, status: "pending", title: "Lease", profiles: { full_name: "Alice" } },
    ...over,
  };
  Object.assign(store.slot.documents as object, docOver);
}

beforeEach(() => {
  jar.clear();
  who.wallet = null;
  who.profile = null;
  store.updates = [];
  store.events = [];
  seed();
});

describe("unlockWithKey", () => {
  it("accepts the invite link's key and remembers it in this browser", async () => {
    expect(await unlockWithKey(SIGNER_ID, invite.secretHex)).toBe(true);
    expect(jar.has("sc_invites")).toBe(true);
  });

  it("refuses another invite's key, a malformed key or an unknown invite", async () => {
    expect(await unlockWithKey(SIGNER_ID, generateInviteKey().secretHex)).toBe(false);
    expect(await unlockWithKey(SIGNER_ID, "not-hex")).toBe(false);
    store.slot = null;
    expect(await unlockWithKey(SIGNER_ID, invite.secretHex)).toBe(false);
    expect(jar.has("sc_invites")).toBe(false);
  });
});

describe("getAccess", () => {
  it("returns nothing for a malformed id, a missing invite or a draft", async () => {
    expect(await getAccess("nope")).toBeNull();
    seed({}, { status: "draft" });
    expect(await getAccess(SIGNER_ID)).toBeNull();
    store.slot = null;
    expect(await getAccess(SIGNER_ID)).toBeNull();
  });

  it("gives a stranger without the link no access", async () => {
    const a = await getAccess(SIGNER_ID);
    expect(a).toMatchObject({ invited: false, canSign: false, isSender: false });
  });

  it("lets the invited person sign after opening the link", async () => {
    await unlockWithKey(SIGNER_ID, invite.secretHex);
    who.wallet = BOB;
    who.profile = { email: "bob@example.com", email_verified_at: null };
    expect(await getAccess(SIGNER_ID)).toMatchObject({ invited: true, canSign: true, wrongAccount: false });
  });

  it("flags someone else signed in with the link as the wrong account", async () => {
    await unlockWithKey(SIGNER_ID, invite.secretHex);
    who.wallet = MALLORY;
    who.profile = { email: "mallory@example.com", email_verified_at: "2026-11-01" };
    expect(await getAccess(SIGNER_ID)).toMatchObject({ invited: true, canSign: false, wrongAccount: true });
  });

  it("ignores a tampered invite cookie", async () => {
    jar.set("sc_invites", "not-a-valid-token");
    who.wallet = BOB;
    who.profile = { email: "bob@example.com", email_verified_at: null };
    expect(await getAccess(SIGNER_ID)).toMatchObject({ invited: false, canSign: false });
  });

  it("lets the sender view but not sign someone else's slot", async () => {
    who.wallet = SENDER;
    who.profile = { email: "alice@example.com", email_verified_at: "2026-11-01" };
    expect(await getAccess(SIGNER_ID)).toMatchObject({ isSender: true, canSign: false });
  });
});

describe("recordView", () => {
  it("marks the invite as viewed once and logs it", async () => {
    await unlockWithKey(SIGNER_ID, invite.secretHex);
    who.wallet = BOB;
    who.profile = { email: "bob@example.com", email_verified_at: null };
    await recordView((await getAccess(SIGNER_ID))!);
    await recordView((await getAccess(SIGNER_ID))!);
    expect(store.updates).toHaveLength(1);
    expect(store.events).toEqual([expect.objectContaining({ kind: "viewed", signer_id: SIGNER_ID })]);
  });

  it("does nothing for a visitor who isn't the invitee", async () => {
    await unlockWithKey(SIGNER_ID, invite.secretHex);
    who.wallet = MALLORY;
    who.profile = { email: "mallory@example.com", email_verified_at: null };
    await recordView((await getAccess(SIGNER_ID))!);
    expect(store.updates).toHaveLength(0);
    expect(store.events).toHaveLength(0);
  });
});

describe("unlockedInvitePrefill", () => {
  it("prefills only for an invite opened in this browser", async () => {
    expect(await unlockedInvitePrefill(SIGNER_ID)).toBeNull();
    expect(await unlockedInvitePrefill(null)).toBeNull();
    await unlockWithKey(SIGNER_ID, invite.secretHex);
    expect(await unlockedInvitePrefill(SIGNER_ID)).toEqual({ name: "Bob", email: "bob@example.com", invitedBy: "Alice" });
  });
});
