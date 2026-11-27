// Menghitung IP pool otomatis dari alamat IP + prefix (CIDR). Detail pool (range, jumlah host)
// selalu dihitung dari ipInterface + prefix; tabel ip_pools hanya menyimpan identitas pool
// (network + prefix) agar port yang berada di pool sama berbagi satu baris yang sama.

function ipToInt(ip) {
  const [a, b, c, d] = ip.split(".").map(Number);
  return (((a << 24) | (b << 16) | (c << 8) | d) >>> 0);
}

function intToIp(n) {
  return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
}

// "/24" -> 24, selain itu null
function parsePrefix(prefix) {
  const m = /^\/(\d{1,2})$/.exec(prefix || "");
  if (!m) return null;
  const len = Number(m[1]);
  return len >= 0 && len <= 32 ? len : null;
}

/**
 * @returns {null | {cidr, network, broadcast, firstHost, lastHost, hosts, range}}
 * - /0../30 : host pertama = network + 1, host terakhir = broadcast - 1
 * - /31     : dua alamat, keduanya dipakai (RFC 3021, link point-to-point)
 * - /32     : satu alamat (host route)
 */
function computePool(ip, prefix) {
  const len = parsePrefix(prefix);
  if (!ip || len === null || !/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return null;

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

// Pool dari baris tabel ip_pools ({network, prefixLength}).
function poolFromRecord(record) {
  if (!record) return null;
  return computePool(record.network, `/${record.prefixLength}`);
}

// Menambahkan field turunan `pool` pada objek port untuk response API.
function withPool(port) {
  return { ...port, pool: computePool(port.ipInterface, port.prefix) };
}

module.exports = { computePool, poolFromRecord, withPool, parsePrefix };
