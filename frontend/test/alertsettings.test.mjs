import test from "node:test";
import assert from "node:assert/strict";
import { summarizeSettings, validateSettings } from "../src/utils/alertSettings.js";

const S = { offlineEnabled: true, offlineAfterFailures: 3, offlineSeverity: "CRITICAL", latencyEnabled: true, latencyThresholdMs: 250, latencySeverity: "WARNING" };

test("ringkasan aturan peringatan", () => {
  assert.deepEqual(summarizeSettings(S), ["Perangkat Off: setelah 3 ping gagal berturut-turut (Kritis)", "Latensi tinggi: mulai 250 ms (Peringatan)"]);
  assert.equal(summarizeSettings({ ...S, offlineEnabled: false })[0], "Peringatan Off dimatikan");
  assert.equal(summarizeSettings({ ...S, latencyEnabled: false })[1], "Peringatan latensi dimatikan");
});

test("validasi: hanya bagian yang aktif, bilangan bulat dalam batas", () => {
  const limits = { failures: [1, 10], latencyMs: [10, 10000] };
  assert.deepEqual(validateSettings(S, limits), {});
  assert.ok(validateSettings({ ...S, offlineAfterFailures: "0" }, limits).offlineAfterFailures);
  assert.ok(validateSettings({ ...S, offlineAfterFailures: "" }, limits).offlineAfterFailures);
  assert.ok(validateSettings({ ...S, latencyThresholdMs: "9" }, limits).latencyThresholdMs);
  assert.ok(validateSettings({ ...S, latencyThresholdMs: "10.5" }, limits).latencyThresholdMs);
  assert.deepEqual(validateSettings({ ...S, offlineEnabled: false, offlineAfterFailures: "x" }, limits), {});
});
