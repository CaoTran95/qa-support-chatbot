import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SEED_ROLES, isSeedRole, parseTokenDomain, seedDomain } from "../lib/admin-auth/domains";

describe("parseTokenDomain", () => {
  it("accepts exactly the four known domains", () => {
    for (const d of ["ecommerce", "community", "ecommerce_buyer", "ecommerce_seller"]) assert.equal(parseTokenDomain(d), d);
  });

  it("rejects anything else", () => {
    for (const v of ["admin", "ecommerce_admin", "__proto__", "constructor", "", " ecommerce", undefined, null, 5, {}, []]) {
      assert.equal(parseTokenDomain(v), null, String(v));
    }
  });
});

describe("seed roles", () => {
  it("maps a role to its domain", () => {
    assert.equal(seedDomain("buyer"), "ecommerce_buyer");
    assert.equal(seedDomain("seller"), "ecommerce_seller");
  });

  it("knows only buyer and seller", () => {
    assert.deepEqual([...SEED_ROLES], ["buyer", "seller"]);
    assert.equal(isSeedRole("buyer"), true);
    assert.equal(isSeedRole("admin"), false);
    assert.equal(isSeedRole(undefined), false);
  });
});
