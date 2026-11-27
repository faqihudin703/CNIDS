// Perhitungan IP pool otomatis dari IP + prefix (CIDR). Logika yang sama dengan
// backend (src/utils/ipPool.js) — dipakai di sini untuk pratinjau langsung di form
// dan tooltip. Pool tidak pernah disimpan, selalu diturunkan dari IP + prefix.

const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

export function isValidIp(ip) {
  return IPV4.test(ip || "");
}

function ipToInt(ip) {
  const [a, b, c, d] = ip.split(".").map(Number);
  return ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;
}

function intToIp(n) {
  return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
}

// "/24" -> 24, selain itu null
export function parsePrefix(prefix) {
  const m = /^\/(\d{1,2})$/.exec(prefix || "");
  if (!m) return null;
  const len = Number(m[1]);
  return len >= 0 && len <= 32 ? len : null;
}

export function computePool(ip, prefix) {
  const len = parsePrefix(prefix);
  if (!isValidIp(ip) || len === null) return null;

  const addr = ipToInt(ip);
  const mask = len === 0 ? 0 : (0xffffffff << (32 - len)) >>> 0;
  const network = (addr & mask) >>> 0;
  const broadcast = (network | (~mask >>> 0)) >>> 0;

  let first;
  let last;
  let hosts;
  if (len === 32) {
    first = last = network;
    hosts = 1;
  } else if (len === 31) {
    first = network;
    last = broadcast;
    hosts = 2;
  } else {
    first = network + 1;
    last = broadcast - 1;
    hosts = broadcast - network - 1;
  }

  return {
    cidr: `${intToIp(network)}/${len}`,
    network: intToIp(network),
    broadcast: intToIp(broadcast),
    firstHost: intToIp(first),
    lastHost: intToIp(last),
    hosts,
    range: first === last ? intToIp(first) : `${intToIp(first)} - ${intToIp(last)}`,
  };
}
