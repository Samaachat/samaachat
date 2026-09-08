import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const campaign = await prisma.campaign.findFirst({
      where: {
        status: "ACTIVE",
      },
      include: {
        product: true,
        priceTiers: {
          orderBy: {
            minQuantity: "asc",
          },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: "Aucune campagne active." },
        { status: 404 }
      );
    }

    const currentQuantity = campaign.currentQuantity;

    const currentTier =
      campaign.priceTiers.find(
        (tier) =>
          currentQuantity >= tier.minQuantity &&
          currentQuantity <= tier.maxQuantity
      ) ?? campaign.priceTiers[0];

    const nextTier = campaign.priceTiers.find(
      (tier) => tier.minQuantity > currentQuantity
    );

  return NextResponse.json({
  id: campaign.id,
  product: campaign.product.name,
  currentQuantity,
  targetQuantity: campaign.targetQuantity,
  currentPrice: currentTier.price,
  nextPrice: nextTier?.price ?? null,
  nextQuantity: nextTier?.minQuantity ?? null,
  priceTiers: campaign.priceTiers.map((tier) => ({
    minQuantity: tier.minQuantity,
    maxQuantity: tier.maxQuantity,
    price: tier.price,
  })),
});
  } catch (error) {
    console.error("Erreur récupération campagne :", error);

    return NextResponse.json(
      { error: "Une erreur est survenue." },
      { status: 500 }
    );
  }
}