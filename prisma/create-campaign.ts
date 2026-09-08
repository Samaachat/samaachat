import { prisma } from "../src/lib/prisma";

async function main() {
  const product = await prisma.product.findFirst({
    where: {
      name: "Riz brisé ordinaire",
    },
  });

  if (!product) {
    throw new Error("Produit introuvable.");
  }

  const campaign = await prisma.campaign.create({
    data: {
      productId: product.id,
      targetQuantity: 100,
      currentQuantity: 0,
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: "ACTIVE",
      priceTiers: {
        create: [
          {
            minQuantity: 1,
            maxQuantity: 49,
            price: 13250,
          },
          {
            minQuantity: 50,
            maxQuantity: 99,
            price: 13000,
          },
          {
            minQuantity: 100,
            maxQuantity: 999999,
            price: 12500,
          },
        ],
      },
    },
    include: {
      product: true,
      priceTiers: true,
    },
  });

  console.log("Nouvelle campagne créée :");
  console.log(campaign);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });