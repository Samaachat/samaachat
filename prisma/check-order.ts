import { prisma } from "../src/lib/prisma";

async function main() {
  const order = await prisma.order.findFirst({
    orderBy: {
      id: "desc",
    },
  });

  console.log("DERNIÈRE COMMANDE :");
  console.log(order);
}

main()
  .catch((error) => {
    console.error(error);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });