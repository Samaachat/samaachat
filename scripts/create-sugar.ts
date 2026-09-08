import { prisma } from "../src/lib/prisma";

async function main() {
  const now = new Date();

  const end = new Date(now);
  end.setDate(end.getDate() + 7);

  const product = await prisma.product.create({
    data: {
      name: "Sucre",
      description: "Sucre en sac pour achat groupé à Dakar",
      category: "Alimentaire",
      unit: "Sac",
      campaigns: {
        create: {
          targetQuantity: 100,
          currentQuantity: 0,
          startDate: now,
          endDate: end,
          status: "ACTIVE",
          priceTiers: {
            create: [
              { minQuantity: 1, maxQuantity: 49, price: 15000 },
              { minQuantity: 50, maxQuantity: 99, price: 14500 },
              { minQuantity: 100, maxQuantity: 999999, price: 14000 },
            ],
          },
        },
      },
    },
  });

  console.log("SUCRE CRÉÉ :", product.name, product.id);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
