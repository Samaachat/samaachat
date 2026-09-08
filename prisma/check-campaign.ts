import { prisma } from "../src/lib/prisma";

async function main() {
  const campaigns = await prisma.campaign.findMany({
    select: {
      id: true,
      status: true,
      currentQuantity: true,
      targetQuantity: true,
    },
  });

  console.log(campaigns);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });