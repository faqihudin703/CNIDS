const { PrismaClient } = require("@prisma/client");

// Singleton pattern supaya tidak membuka koneksi baru tiap kali di-require,
// terutama penting saat nodemon melakukan hot-reload di development.
const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;
