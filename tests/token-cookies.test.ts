import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

describe("token-cookies seal/unseal", () => {
  before(() => {
    process.env.QA_INTERNAL_SECRET = "s".repeat(40);
  });

  it("round-trips a string", async () => {
    const { sealString, unsealString } = await import("../lib/admin-auth/token-cookies");
    const packed = sealString(JSON.stringify({ accessToken: "abc", expiresAt: 99 }));
    assert.notEqual(packed, "abc");
    assert.deepEqual(JSON.parse(unsealString(packed) ?? ""), { accessToken: "abc", expiresAt: 99 });
  });

  it("rejects tampering", async () => {
    const { sealString, unsealString } = await import("../lib/admin-auth/token-cookies");
    const packed = sealString("hello");
    const broken = packed.slice(0, -4) + "xxxx";
    assert.equal(unsealString(broken), undefined);
  });
});
