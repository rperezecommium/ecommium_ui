import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";
function fixture(session = { employeeId: "employee" }) {
  let verified = 0,
    saved = 0,
    cleared = 0;
  class ResponseStub {
    constructor(body, init) {
      Object.assign(this, { body, ...init });
    }
  }
  const route = loadTs("app/auth/admin/session-renew/route.ts", {
    "next/server": { NextResponse: ResponseStub },
    "../../../../src/modules/auth/admin-session-actions": {
      refreshAdminEmployeeSession: async () => {
        verified++;
        return session;
      },
    },
    "../../../../src/shared/auth/session": {
      saveAdminSession: async () => saved++,
      clearAdminSession: async () => cleared++,
    },
  });
  return { route, counts: () => ({ verified, saved, cleared }) };
}
const request = (next, site = "same-origin") => ({
  headers: new Headers({ "sec-fetch-site": site }),
  nextUrl: new URL(
    "http://localhost:5173/auth/admin/session-renew?next=" +
      encodeURIComponent(next),
  ),
});
test("renew handoff preserves origin with relative redirect and exposes no token body", async () => {
  const f = fixture(),
    r = await f.route.GET(request("/admin/pagos"));
  assert.equal(r.status, 303);
  assert.equal(r.headers.Location, "/admin/pagos");
  assert.equal(r.headers["Cache-Control"], "private, no-store, max-age=0");
  assert.equal(r.body, null);
  assert.deepEqual(f.counts(), { verified: 1, saved: 1, cleared: 0 });
});
test("rejects cross-site cookie rotation before touching a session", async () => {
  const f = fixture(),
    r = await f.route.GET(request("/admin", "cross-site"));
  assert.equal(r.status, 403);
  assert.equal(f.counts().verified, 0);
});
test("external and malformed return targets cannot cause an open redirect", async () => {
  for (const next of [
    "https://evil.invalid",
    "//evil.invalid",
    "/administrator",
    "/admin\\evil",
    "/admin\r\nLocation:evil",
  ]) {
    const f = fixture(),
      r = await f.route.GET(request(next));
    assert.equal(r.headers.Location, "/admin");
  }
});
test("failed renewal clears local state and returns to login", async () => {
  const f = fixture(null),
    r = await f.route.GET(request("/admin/pagos"));
  assert.equal(r.headers.Location, "/auth/login?next=%2Fadmin%2Fpagos");
  assert.equal(f.counts().cleared, 1);
  assert.equal(f.counts().saved, 0);
});
