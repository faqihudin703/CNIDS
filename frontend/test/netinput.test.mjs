import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeIp, ipError, formatMac, macError, isValidMac, splitInterval, toSeconds, intervalError, formatInterval } from "../src/utils/netInput.js";

test("sanitizeIp: hanya angka dan titik", () => {
  assert.equal(sanitizeIp("192.168.1.10"), "192.168.1.10");
  assert.equal(sanitizeIp("abc192,168 .1x.10"), "192168.1.10");
  assert.equal(sanitizeIp("10..0...1"), "10.0.1");
  assert.equal(sanitizeIp(".10"), "10");
  assert.equal(sanitizeIp("1111111111111111111"), "111111111111111");
});

test("ipError: valid/kosong -> null, selain itu pesan", () => {
  assert.equal(ipError(""), null);
  assert.equal(ipError("10.1.0.3"), null);
  assert.ok(ipError("10.1.0"));
  assert.ok(ipError("256.1.1.1"));
  assert.ok(ipError("1.2.3.4.5"));
});

test("formatMac: hanya 0-9 A-F, kapital, titik dua tiap 2 karakter", () => {
  assert.equal(formatMac("00d0f8123456"), "00:D0:F8:12:34:56");
  assert.equal(formatMac("00-d0-f8-12-34-56"), "00:D0:F8:12:34:56");
  assert.equal(formatMac("zz00xyd0"), "00:D0");
  assert.equal(formatMac("00D0F81234567890"), "00:D0:F8:12:34:56"); // dipotong 12 karakter
  assert.equal(formatMac("0"), "0");
});

test("macError / isValidMac", () => {
  assert.equal(macError(""), null);
  assert.equal(macError("00:D0:F8:12:34:56"), null);
  assert.ok(isValidMac("00:d0:f8:12:34:56"));
  assert.match(macError("00:D0:F8"), /kurang 6/);
});

test("jeda ping: pecah, hitung, validasi, format", () => {
  assert.deepEqual(splitInterval(300), { value: "5", unit: "m" });
  assert.deepEqual(splitInterval(90), { value: "90", unit: "s" });
  assert.deepEqual(splitInterval(7200), { value: "2", unit: "h" });
  assert.equal(toSeconds("5", "m"), 300);
  assert.equal(intervalError("30", "s"), null);
  assert.ok(intervalError("5", "s"));
  assert.ok(intervalError("25", "h"));
  assert.ok(intervalError("", "s"));
  assert.ok(intervalError("0.5", "s"));
  assert.equal(formatInterval(300), "5 menit");
});
