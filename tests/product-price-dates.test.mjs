import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

const { isoToDateTimeLocal, dateTimeLocalToIso } = loadTs("src/modules/catalogo/product-price-dates.ts");

function inZone(zone, run) {
  const previous = process.env.TZ;
  process.env.TZ = zone;
  try { run(); } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
}

test("saved promotion instants reopen and resave exactly in UTC, Madrid and New York", () => {
  for (const zone of ["UTC", "Europe/Madrid", "America/New_York"]) inZone(zone, () => {
    for (const instant of [
      "2026-11-12T23:00:00.000Z", "2026-11-13T23:00:00.000Z",
      "2026-03-29T00:59:00.000Z", "2026-03-29T01:00:00.000Z",
      "2026-10-25T00:30:00.000Z", "2026-10-25T01:30:00.000Z",
      "2026-10-25T02:30:15.123+01:00",
      "2026-11-01T05:30:00.000Z", "2026-11-01T06:30:00.000Z",
    ]) assert.equal(dateTimeLocalToIso(isoToDateTimeLocal(instant), instant), instant, `${zone}: ${instant}`);
  });
});

test("Madrid input uses the correct offset on each side of midnight and summer time", () => inZone("Europe/Madrid", () => {
  for (const [local, instant] of [
    ["2026-11-13T00:00", "2026-11-12T23:00:00.000Z"],
    ["2026-11-14T00:00", "2026-11-13T23:00:00.000Z"],
    ["2026-03-29T01:59", "2026-03-29T00:59:00.000Z"],
    ["2026-03-29T03:00", "2026-03-29T01:00:00.000Z"],
  ]) {
    assert.equal(dateTimeLocalToIso(local), instant);
    assert.equal(isoToDateTimeLocal(instant), local);
  }
}));

test("editing either occurrence of Madrid's repeated hour retains that occurrence", () => inZone("Europe/Madrid", () => {
  assert.equal(isoToDateTimeLocal("2026-10-25T00:30:00Z"), "2026-10-25T02:30");
  assert.equal(isoToDateTimeLocal("2026-10-25T01:30:00Z"), "2026-10-25T02:30");
  assert.equal(dateTimeLocalToIso("2026-10-25T02:45", "2026-10-25T00:30:00Z"), "2026-10-25T00:45:00.000Z");
  assert.equal(dateTimeLocalToIso("2026-10-25T02:45", "2026-10-25T01:30:00Z"), "2026-10-25T01:45:00.000Z");
  assert.equal(dateTimeLocalToIso("2026-10-25T03:00", "2026-10-25T00:30:00Z"), "2026-10-25T02:00:00.000Z");
}));

test("nonexistent or malformed dates are rejected rather than silently shifted", () => inZone("Europe/Madrid", () => {
  for (const value of ["2026-03-29T02:30", "2026-02-30T12:00", "2026-99-99T12:00", "invalid"]) {
    assert.equal(dateTimeLocalToIso(value), null);
    assert.equal(dateTimeLocalToIso(value, "2026-10-25T01:30:00Z"), null);
  }
  assert.equal(dateTimeLocalToIso(""), null);
  assert.equal(isoToDateTimeLocal(null), "");
  assert.equal(isoToDateTimeLocal("invalid"), "");
}));
