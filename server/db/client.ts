import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PrismaClient } from "@/generated/prisma/client";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://mathforces:mathforces@localhost:5432/mathforces?schema=public";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const configuredPoolSize = Number(process.env.DATABASE_POOL_SIZE ?? 15);
  const pool = new pg.Pool({
    allowExitOnIdle: true,
    connectionString,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    max: Number.isInteger(configuredPoolSize) && configuredPoolSize > 0 ? configuredPoolSize : 15,
    query_timeout: 30_000,
    statement_timeout: 30_000
  });
  const adapter = new PrismaPg(pool, {
    onPoolError: (error) => console.error("Ошибка пула PostgreSQL", error)
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
