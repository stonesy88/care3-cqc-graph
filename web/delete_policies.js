const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const targetId = '1ca0c56a-cd62-491b-98e8-e865ee6e23d1';
  const result = await prisma.policy.deleteMany({
    where: {
      NOT: { id: targetId }
    }
  });
  console.log(`Deleted ${result.count} policies from Postgres.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
