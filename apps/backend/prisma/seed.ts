// Optional: seed a demo collection or leave empty for fresh MVP
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // No seed required for MVP
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
