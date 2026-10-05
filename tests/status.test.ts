import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { liveToken, publicStatus } from "../lib/admin-auth/status";
import { adminTokenStore, type AdminTokenData } from "../lib/admin-auth/store";

const SID = "a".repeat(64);
const tok = (accessToken: string, expiresAt?: number) => ({ accessToken, expiresAt });
const put = (data: Partial<AdminTokenData>) =>
  adminTokenStore.set(SID, { email: "", createdAt: Date.now(), tokens: {}, ...data });

beforeEach(async () => {
  await adminTokenStore.delete(SID);
});

describe("liveToken across roles", () => {
  it("never serves a buyer token for the admin ecommerce domain, nor the reverse", async () => {
    await put({ tokens: { ecommerce_buyer: tok("BUYER") } });
    assert.equal(liveToken(await adminTokenStore.get(SID), "ecommerce"), undefined);
    await put({ tokens: { ecommerce: tok("ADMIN") } });
    assert.equal(liveToken(await adminTokenStore.get(SID), "ecommerce_seller"), undefined);
    assert.equal(liveToken(await adminTokenStore.get(SID), "ecommerce_buyer"), undefined);
  });

  it("keeps the community to ecommerce fallback", async () => {
    await put({ tokens: { community: tok("COMM") } });
    assert.equal(liveToken(await adminTokenStore.get(SID), "ecommerce")?.accessToken, "COMM");
  });

  it("does not use an expired role token", async () => {
    await put({ tokens: { ecommerce_seller: tok("OLD", Date.now() - 1000) } });
    assert.equal(liveToken(await adminTokenStore.get(SID), "ecommerce_seller"), undefined);
  });
});

describe("publicStatus", () => {
  it("reports connected roles with their email, and nothing for the others", async () => {
    await put({ email: "admin@x.vn", tokens: { ecommerce: tok("ADMIN"), ecommerce_buyer: tok("BUYER") }, seedEmails: { buyer: "b@x.vn" } });
    const s = await publicStatus(SID);
    assert.equal(s.ecommerce, true);
    assert.deepEqual(s.seed.buyer, { connected: true, email: "b@x.vn" });
    assert.deepEqual(s.seed.seller, { connected: false, email: null });
  });

  it("does not count a role login as an Admin connection", async () => {
    await put({ tokens: { ecommerce_buyer: tok("BUYER") }, seedEmails: { buyer: "b@x.vn" } });
    const s = await publicStatus(SID);
    assert.equal(s.connected, false);
    assert.equal(s.email, null);
  });

  it("never contains a token", async () => {
    await put({ email: "admin@x.vn", tokens: { ecommerce: tok("SECRET-ADMIN"), ecommerce_buyer: tok("SECRET-BUYER") }, seedEmails: { buyer: "b@x.vn" } });
    const text = JSON.stringify(await publicStatus(SID));
    assert.ok(!text.includes("SECRET"));
  });

  it("is all-false for an unknown session", async () => {
    const s = await publicStatus(undefined);
    assert.deepEqual(s.seed, { buyer: { connected: false, email: null }, seller: { connected: false, email: null } });
  });
});
