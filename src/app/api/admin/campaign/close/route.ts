import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const campaignId = Number(body.campaignId);

    if (!Number.isInteger(campaignId) || campaignId < 1) {
      return NextResponse.json(
        {
          success: false,
          message: "Campagne invalide.",
        },
        { status: 400 }
      );
    }

    const campaign = await prisma.campaign.findUnique({
      where: {
        id: campaignId,
      },
      include: {
        product: true,
        priceTiers: {
          orderBy: {
            minQuantity: "desc",
          },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json(
        {
          success: false,
          message: "Campagne introuvable.",
        },
        { status: 404 }
      );
    }

    if (campaign.status !== "ACTIVE") {
      return NextResponse.json(
        {
          success: false,
          message: "Cette campagne n'est plus active.",
        },
        { status: 400 }
      );
    }

    const finalTier = campaign.priceTiers.find(
      (tier) => campaign.currentQuantity >= tier.minQuantity
    );

    if (!finalTier) {
      return NextResponse.json(
        {
          success: false,
          message: "Aucun palier de prix ne correspond à la quantité finale.",
        },
        { status: 400 }
      );
    }

    let ordersUpdated = 0;
    let itemsUpdated = 0;

    await prisma.$transaction(async (tx) => {
      // Récupérer uniquement les articles appartenant
      // à la campagne que l'administrateur veut clôturer.
      const campaignItems = await tx.orderItem.findMany({
        where: {
          campaignId: campaign.id,
        },
      });

      // Appliquer le prix final uniquement aux articles
      // de cette campagne.
      for (const item of campaignItems) {
        await tx.orderItem.update({
          where: {
            id: item.id,
          },
          data: {
            unitPrice: finalTier.price,
            amount: item.quantity * finalTier.price,
          },
        });

        itemsUpdated++;
      }

      // Récupérer les commandes concernées.
      const orderIds = [
        ...new Set(campaignItems.map((item) => item.orderId)),
      ];

      for (const orderId of orderIds) {
        const orderItems = await tx.orderItem.findMany({
          where: {
            orderId,
          },
        });

        // Recalculer le montant total de la commande
        // à partir de tous ses produits.
        const totalAmount = orderItems.reduce(
          (total, item) => total + item.amount,
          0
        );

        await tx.order.update({
          where: {
            id: orderId,
          },
          data: {
            amount: totalAmount,
          },
        });

        ordersUpdated++;
      }

      // Enfin, clôturer UNIQUEMENT la campagne sélectionnée.
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
      product: campaign.product.name,
      finalUnitPrice: finalTier.price,
      ordersUpdated,
      itemsUpdated,
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