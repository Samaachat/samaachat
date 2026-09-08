import { prisma } from "../src/lib/prisma";

async function main() {
  const product = await prisma.product.create({
    data: {
      name: "Riz brisé ordinaire",
      description: "Sac de riz brisé ordinaire de 50 kg.",
      category: "Riz",
      unit: "Sac de 50 kg",
    },
  });

  const campaign = await prisma.campaign.create({
    data: {
      productId: product.id,
      targetQuantity: 100,
      currentQuantity: 0,
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
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
  });

  console.log("Produit créé :", product.name);
  console.log("Campagne créée :", campaign.id);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });