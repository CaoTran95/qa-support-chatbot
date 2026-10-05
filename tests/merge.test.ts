import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mergeAdminLogin, mergeSeedLogin } from "../lib/admin-auth/merge";
import type { AdminTokenData } from "../lib/admin-auth/store";

const tok = (accessToken: string) => ({ accessToken });
const prev: AdminTokenData = {
  email: "admin@x.vn",
  createdAt: 100,
  tokens: { ecommerce: tok("A"), community: tok("C"), ecommerce_buyer: tok("B"), ecommerce_seller: tok("S") },
  seedEmails: { buyer: "b@x.vn", seller: "s@x.vn" },
};

describe("mergeAdminLogin", () => {
  it("same admin community login: replaces community and drops leftover ecommerce", () => {
    const m = mergeAdminLogin(prev, { email: "admin@x.vn", domain: "community", token: tok("C2"), createdAt: 200 });
    assert.equal(m.createdAt, 200);
    assert.equal(m.tokens.community?.accessToken, "C2");
    assert.equal(m.tokens.ecommerce, undefined);
    assert.equal(m.tokens.ecommerce_buyer?.accessToken, "B");
  });

  it("different admin: drops the old admin tokens but keeps buyer and seller", () => {
    const m = mergeAdminLogin(prev, { email: "other@x.vn", domain: "community", token: tok("C3"), createdAt: 200 });
    assert.equal(m.email, "other@x.vn");
    assert.equal(m.tokens.ecommerce, undefined);
    assert.equal(m.tokens.community?.accessToken, "C3");
    assert.equal(m.tokens.ecommerce_buyer?.accessToken, "B");
    assert.equal(m.tokens.ecommerce_seller?.accessToken, "S");
    assert.deepEqual(m.seedEmails, { buyer: "b@x.vn", seller: "s@x.vn" });
  });

  it("works with no previous record", () => {
    const m = mergeAdminLogin(undefined, { email: "a@x.vn", domain: "community", token: tok("C"), createdAt: 5 });
    assert.deepEqual(m, { email: "a@x.vn", createdAt: 5, tokens: { community: tok("C") } });
  });
});

describe("mergeSeedLogin", () => {
  it("leaves the admin email, createdAt and tokens untouched", () => {
    const m = mergeSeedLogin(prev, { role: "buyer", email: "b2@x.vn", token: tok("B2"), now: 999 });
    assert.equal(m.email, "admin@x.vn");
    assert.equal(m.createdAt, 100);
    assert.equal(m.tokens.ecommerce?.accessToken, "A");
    assert.equal(m.tokens.ecommerce_buyer?.accessToken, "B2");
    assert.equal(m.tokens.ecommerce_seller?.accessToken, "S");
    assert.deepEqual(m.seedEmails, { buyer: "b2@x.vn", seller: "s@x.vn" });
  });

  it("creates a record with an empty admin email when none exists", () => {
    const m = mergeSeedLogin(undefined, { role: "seller", email: "s@x.vn", token: tok("S"), now: 7 });
    assert.deepEqual(m, { email: "", createdAt: 7, tokens: { ecommerce_seller: tok("S") }, seedEmails: { seller: "s@x.vn" } });
  });
});
