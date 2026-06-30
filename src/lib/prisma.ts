import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function getDefaultStore() {
  const store = await prisma.store.findFirst();
  if (store) return store;

  return prisma.store.create({
    data: {
      name: "喫茶店",
      openTime: "11:00",
      closeTime: "18:00",
      regularClosedDays: [3],
    },
  });
}
