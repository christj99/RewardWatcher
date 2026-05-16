import { prisma, seedDatabase } from "../packages/db/src/index.js";

async function main(): Promise<void> {
  try {
    await seedDatabase();
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
