import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sessionStillValid, type AdminTokenData } from "../lib/admin-auth/store";

const base = (over: Partial<AdminTokenData> = {}): AdminTokenData => ({
  email: "a@x.vn",
  createdAt: Date.now() - 1000,
  tokens: {},
  ...over,
});

describe("sessionStillValid", () => {
  it("keeps a live token even when createdAt is old", () => {
    const v = base({
      createdAt: Date.now() - 200 * 24 * 60 * 60 * 1000,
      tokens: { community: { accessToken: "t", expiresAt: Date.now() + 60_000 } },
    });
    assert.equal(sessionStillValid(v), true);
  });

  it("drops when every token with exp is expired", () => {
    const v = base({
      tokens: {
        community: { accessToken: "t", expiresAt: Date.now() - 1000 },
        ecommerce_buyer: { accessToken: "b", expiresAt: Date.now() - 1000 },
      },
    });
    assert.equal(sessionStillValid(v), false);
  });

  it("keeps tokens without exp within the safety cap", () => {
    const v = base({
      createdAt: Date.now() - 1000,
      tokens: { community: { accessToken: "t" } },
    });
    assert.equal(sessionStillValid(v), true);
  });
});
