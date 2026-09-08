import { prisma } from "../src/lib/prisma";

async function main() {
  const products = [
    {
      name: "Huile alimentaire",
      description: "Huile alimentaire 5 L - prix de test",
      category: "Huiles",
      unit: "bidon de 5 L",
      tiers: [
        { minQuantity: 1, maxQuantity: 9, price: 7000 },
        { minQuantity: 10, maxQuantity: 49, price: 6750 },
        { minQuantity: 50, maxQuantity: 99, price: 6500 },
        { minQuantity: 100, maxQuantity: 200, price: 6250 },
      ],
    },
    {
      name: "Pomme de terre",
      description: "Pomme de terre 25 kg - prix de test",
      category: "Légumes",
      unit: "sac de 25 kg",
      tiers: [
        { minQuantity: 1, maxQuantity: 9, price: 9000 },
        { minQuantity: 10, maxQuantity: 49, price: 8500 },
        { minQuantity: 50, maxQuantity: 99, price: 8000 },
        { minQuantity: 100, maxQuantity: 200, price: 7500 },
      ],
    },
    {
      name: "Oignon",
      description: "Oignon 25 kg - prix de test",
      category: "Légumes",
      unit: "sac de 25 kg",
      tiers: [
        { minQuantity: 1, maxQuantity: 9, price: 8000 },
        { minQuantity: 10, maxQuantity: 49, price: 7500 },
        { minQuantity: 50, maxQuantity: 99, price: 7000 },
        { minQuantity: 100, maxQuantity: 200, price: 6500 },
      ],
    },
  ];

  for (const data of products) {
    const existing = await prisma.product.findFirst({
      where: {
        name: data.name,
      },
    });

    if (existing) {
      console.log(`Produit déjà présent : ${data.name}`);
      continue;
    }

    const product = await prisma.product.create({
      data: {
        name: data.name,
        description: data.description,
        category: data.category,
        unit: data.unit,
      },
    });

    const campaign = await prisma.campaign.create({
      data: {
        productId: product.id,
        targetQuantity: 200,
        currentQuantity: 0,
        startDate: new Date(),
        endDate: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        ),
        status: "ACTIVE",
      },
    });

    await prisma.priceTier.createMany({
      data: data.tiers.map((tier) => ({
        campaignId: campaign.id,
        minQuantity: tier.minQuantity,
        maxQuantity: tier.maxQuantity,
        price: tier.price,
      })),
    });

    console.log(
      `Créé : ${data.name} — campagne #${campaign.id}`
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });