import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
        { success: false, message: "Aucune campagne active." },
        { status: 404 }
      );
    }

    const finalTier =
      campaign.priceTiers.find(
        (tier) => campaign.currentQuantity >= tier.minQuantity
      ) ?? campaign.priceTiers[campaign.priceTiers.length - 1];

    if (!finalTier) {
      return NextResponse.json(
        { success: false, message: "Aucun palier de prix trouvé." },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      for (const order of campaign.orders) {
        await tx.order.update({
          where: {
            id: order.id,
          },
          data: {
            finalUnitPrice: finalTier.price,
            finalAmount: order.quantity * finalTier.price,
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
      {
        success: false,
        message: "Impossible de clôturer la campagne.",
      },
      { status: 500 }
    );
  }
}