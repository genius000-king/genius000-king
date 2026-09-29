import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkBasicAuth, isPublicPath } from "./auth.ts";

const basic = (creds: string) => `Basic ${Buffer.from(creds).toString("base64")}`;

describe("checkBasicAuth", () => {
  it("fails closed when no password is configured", () => {
    assert.equal(checkBasicAuth(basic("admin:"), "admin", undefined), false);
    assert.equal(checkBasicAuth(basic("admin:"), "admin", ""), false);
    assert.equal(checkBasicAuth(basic(":"), undefined, ""), false);
  });

  it("accepts the right credentials", () => {
    assert.equal(checkBasicAuth(basic("root:s3cret"), "root", "s3cret"), true);
  });

  it("defaults the username to admin", () => {
    assert.equal(checkBasicAuth(basic("admin:s3cret"), undefined, "s3cret"), true);
    assert.equal(checkBasicAuth(basic("admin:s3cret"), "", "s3cret"), true);
  });

  it("rejects a wrong password or wrong user", () => {
    assert.equal(checkBasicAuth(basic("root:nope"), "root", "s3cret"), false);
    assert.equal(checkBasicAuth(basic("other:s3cret"), "root", "s3cret"), false);
  });

  it("rejects missing, non-Basic and malformed headers", () => {
    assert.equal(checkBasicAuth(null, "root", "s3cret"), false);
    assert.equal(checkBasicAuth("Bearer s3cret", "root", "s3cret"), false);
    assert.equal(checkBasicAuth("Basic", "root", "s3cret"), false);
    assert.equal(checkBasicAuth(basic("no-colon-here"), "root", "s3cret"), false);
    assert.equal(checkBasicAuth("Basic %%%not-base64%%%", "root", "s3cret"), false);
  });

  it("supports passwords containing colons", () => {
    assert.equal(checkBasicAuth(basic("root:a:b:c"), "root", "a:b:c"), true);
  });
});

describe("isPublicPath", () => {
  it("only exposes the health check", () => {
    assert.equal(isPublicPath("/api/health"), true);
    assert.equal(isPublicPath("/"), false);
    assert.equal(isPublicPath("/api/health/extra"), false);
    assert.equal(isPublicPath("/api/hook/telegram"), false);
  });
});
