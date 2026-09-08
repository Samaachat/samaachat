import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const campaign = await prisma.campaign.findFirst({
      where: {
        status: "ACTIVE",
      },
      include: {
        priceTiers: {
          orderBy: {
            minQuantity: "desc",
          },
        },
        orders: true,
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: "Aucune campagne active." },
        { status: 404 }
      );
    }

    const finalTier =
      campaign.priceTiers.find(
        (tier) => campaign.currentQuantity >= tier.minQuantity
      ) ?? campaign.priceTiers[0];

    if (!finalTier) {
      return NextResponse.json(
        { error: "Aucun palier de prix disponible." },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      for (const order of campaign.orders) {
        const finalAmount = order.quantity * finalTier.price;

        await tx.order.update({
          where: {
            id: order.id,
          },
          data: {
            finalUnitPrice: finalTier.price,
            finalAmount,
          },
        });
      }

      await tx.campaign.update({
        where: {
          id: campaign.id,
        },
        data: {
          status: "COMPLETED",
        },
      });
    });

    return NextResponse.json({
      success: true,
      campaignId: campaign.id,
      finalUnitPrice: finalTier.price,
      ordersUpdated: campaign.orders.length,
    });
  } catch (error) {
    console.error("Erreur clôture campagne :", error);

    return NextResponse.json(
      { error: "Une erreur est survenue." },
      { status: 500 }
    );
  }
}