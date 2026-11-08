import { describe, expect, it } from "vitest";
import { friendlyError, rethrowNext } from "./errors";

describe("friendlyError", () => {
  it("keeps our own readable messages", () => {
    expect(friendlyError(new Error("You declined in Varial. Nothing was recorded."))).toBe("You declined in Varial. Nothing was recorded.");
  });
  it("explains dropped connections", () => {
    expect(friendlyError(new TypeError("Failed to fetch"))).toMatch(/couldn’t reach the server/);
    expect(friendlyError(new TypeError("Load failed"))).toMatch(/couldn’t reach the server/);
  });
  it("hides production server errors and code bugs", () => {
    expect(friendlyError(new Error("An error occurred in the Server Components render. The specific message is omitted in production builds"))).toMatch(/on our side/);
    expect(friendlyError(new TypeError("Cannot read properties of undefined (reading 'ok')"))).toMatch(/on our side/);
    expect(friendlyError(undefined, "Custom")).toBe("Custom");
  });
  it("asks for a refresh after a new deploy", () => {
    expect(friendlyError(new Error('Failed to find Server Action "abc". This request might be from an older or newer deployment.'))).toMatch(/out of date/);
  });
});

describe("rethrowNext", () => {
  it("rethrows redirects and ignores ordinary errors", () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/sign-in;307;" });
    expect(() => rethrowNext(redirect)).toThrow();
    expect(() => rethrowNext(new Error("nope"))).not.toThrow();
  });
});
