import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseSeedMarker } from "../lib/admin-auth/seed-marker";

describe("parseSeedMarker", () => {
  it("reads one role and strips the marker", () => {
    assert.deepEqual(parseSeedMarker("Cần đăng nhập.\n[[SEED_AUTH_REQUIRED:buyer]]"), { reply: "Cần đăng nhập.", roles: ["buyer"] });
  });

  it("reads both roles in order", () => {
    assert.deepEqual(parseSeedMarker("x [[SEED_AUTH_REQUIRED:buyer,seller]]").roles, ["buyer", "seller"]);
  });

  it("ignores unknown roles, trims spaces and removes duplicates", () => {
    assert.deepEqual(parseSeedMarker("[[SEED_AUTH_REQUIRED: seller ,admin,seller,]]").roles, ["seller"]);
  });

  it("strips a marker with no valid role without reporting any", () => {
    assert.deepEqual(parseSeedMarker("ok [[SEED_AUTH_REQUIRED:admin]]"), { reply: "ok", roles: [] });
  });

  it("handles several markers and leaves a reply without markers untouched", () => {
    assert.deepEqual(parseSeedMarker("a [[SEED_AUTH_REQUIRED:buyer]] b [[SEED_AUTH_REQUIRED:seller]]").roles, ["buyer", "seller"]);
    assert.deepEqual(parseSeedMarker("không có dấu hiệu"), { reply: "không có dấu hiệu", roles: [] });
  });

  it("does not treat the admin marker as a seed marker", () => {
    assert.deepEqual(parseSeedMarker("[[ADMIN_AUTH_REQUIRED]]"), { reply: "[[ADMIN_AUTH_REQUIRED]]", roles: [] });
  });
});
