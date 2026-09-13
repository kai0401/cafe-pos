import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

/** スキーマ変更後に古いシングルトンが残ると delegate が undefined になる */
function isClientHealthy(client: PrismaClient): boolean {
  return (
    typeof client.expense?.findMany === "function" &&
    typeof client.salesDailySummary?.findMany === "function" &&
    typeof client.staffMember?.findMany === "function" &&
    typeof client.shift?.findMany === "function"
  );
}

function getPrismaClient(): PrismaClient {
  const cached = globalForPrisma.prisma;
  if (cached && isClientHealthy(cached)) {
    return cached;
  }

  if (cached) {
    void cached.$disconnect();
  }

  const client = createPrismaClient();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }
  return client;
}

export const prisma = getPrismaClient();

export async function getDefaultStore() {
  const store = await prisma.store.findFirst();
  if (store) return store;

  return prisma.store.create({
    data: {
      name: "あづま家",
      openTime: "11:00",
      closeTime: "18:00",
      regularClosedDays: [3],
    },
  });
}
