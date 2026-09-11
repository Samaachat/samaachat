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
          error: "Campagne invalide.",
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
          error: "Campagne introuvable.",
        },
        { status: 404 }
      );
    }

    if (campaign.status !== "ACTIVE") {
      return NextResponse.json(
        {
          success: false,
          error: "Cette campagne n'est plus active.",
        },
        { status: 400 }
      );
    }

    /*
     * Le palier final correspond à la quantité totale
     * atteinte par cette campagne au moment de sa clôture.
     */
    const finalTier = campaign.priceTiers.find(
      (tier) => campaign.currentQuantity >= tier.minQuantity
    );

    if (!finalTier) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Aucun palier de prix ne correspond à la quantité finale.",
        },
        { status: 400 }
      );
    }

    let ordersUpdated = 0;
    let itemsUpdated = 0;

    await prisma.$transaction(async (tx) => {
      /*
       * Récupération uniquement des OrderItem
       * appartenant à la campagne clôturée.
       */
      const campaignItems = await tx.orderItem.findMany({
        where: {
          campaignId: campaign.id,
        },
        include: {
          order: {
            include: {
              items: {
                include: {
                  campaign: true,
                },
              },
            },
          },
        },
      });

      /*
       * Mise à jour du prix de chaque article
       * de cette campagne.
       */
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

      /*
       * Chaque commande peut contenir plusieurs campagnes.
       *
       * Après modification des articles de cette campagne,
       * on recalcule le montant total de chaque commande.
       */
      const orderIds = [
        ...new Set(campaignItems.map((item) => item.orderId)),
      ];

      for (const orderId of orderIds) {
        const orderItems = await tx.orderItem.findMany({
          where: {
            orderId,
          },
          include: {
            campaign: true,
          },
        });

        const totalAmount = orderItems.reduce(
          (total, item) => total + item.amount,
          0
        );

        /*
         * Une commande est complètement finalisée uniquement
         * lorsque toutes les campagnes de ses articles sont
         * elles-mêmes clôturées.
         */
        const allCampaignsCompleted = orderItems.every(
          (item) => item.campaign.status === "COMPLETED"
        );

        await tx.order.update({
          where: {
            id: orderId,
          },
          data: {
            amount: totalAmount,
            finalAmount: allCampaignsCompleted
              ? totalAmount
              : null,
          },
        });

        ordersUpdated++;
      }

      /*
       * La campagne est clôturée en dernier.
       *
       * Cela permet aux calculs ci-dessus de voir son ancien
       * statut ACTIVE. Nous mettons ensuite son statut à COMPLETED.
       */
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
        error: "Impossible de clôturer la campagne.",
      },
      { status: 500 }
    );
  }
}