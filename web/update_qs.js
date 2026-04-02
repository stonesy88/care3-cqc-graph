const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.policy.updateMany({
    data: { qsIds: ['1', '5', '10', '34'] }
  });
  console.log("Successfully updated all policies with mock qsIds!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
