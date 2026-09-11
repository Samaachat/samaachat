import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type OrderItemInput = {
  campaignId: number;
  quantity: number;
  price?: number;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const name = String(body.name ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const address = String(body.address ?? "").trim();

    const rawItems = Array.isArray(body.items) ? body.items : [];

    if (!name || !phone) {
      return NextResponse.json(
        {
          success: false,
          error: "Nom et téléphone obligatoires.",
        },
        { status: 400 }
      );
    }

    if (!address) {
      return NextResponse.json(
        {
          success: false,
          error: "Adresse de livraison obligatoire.",
        },
        { status: 400 }
      );
    }

    if (rawItems.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Veuillez choisir au moins un produit.",
        },
        { status: 400 }
      );
    }

    /*
     * Nettoyage et validation des articles reçus.
     */
    const items: OrderItemInput[] = rawItems.map(
      (item: {
        campaignId?: unknown;
        quantity?: unknown;
        price?: unknown;
      }) => ({
        campaignId: Number(item.campaignId),
        quantity: Number(item.quantity),
        price:
          item.price !== undefined
            ? Number(item.price)
            : undefined,
      })
    );

    for (const item of items) {
      if (
        !Number.isInteger(item.campaignId) ||
        item.campaignId < 1
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "Campagne invalide.",
          },
          { status: 400 }
        );
      }

      if (
        !Number.isInteger(item.quantity) ||
        item.quantity < 1
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "Quantité invalide.",
          },
          { status: 400 }
        );
      }
    }

    /*
     * Empêcher qu'une même campagne soit envoyée plusieurs fois.
     */
    const campaignIds = items.map((item) => item.campaignId);

    if (new Set(campaignIds).size !== campaignIds.length) {
      return NextResponse.json(
        {
          success: false,
          error: "Un produit ne peut apparaître qu'une seule fois.",
        },
        { status: 400 }
      );
    }

    /*
     * Récupérer toutes les campagnes demandées.
     *
     * Le prix est recalculé côté serveur.
     * On ne fait donc jamais confiance au prix envoyé
     * par le navigateur.
     */
    const campaigns = await prisma.campaign.findMany({
      where: {
        id: {
          in: campaignIds,
        },
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

    if (campaigns.length !== campaignIds.length) {
      return NextResponse.json(
        {
          success: false,
          error: "Une ou plusieurs campagnes sont introuvables.",
        },
        { status: 404 }
      );
    }

    /*
     * Vérifier que toutes les campagnes sont encore actives
     * et déterminer le prix actuel de chaque produit.
     */
    const validatedItems: {
  campaign: (typeof campaigns)[number];
  quantity: number;
  unitPrice: number;
  amount: number;
}[] = [];

    for (const item of items) {
      const campaign = campaigns.find(
        (currentCampaign) =>
          currentCampaign.id === item.campaignId
      );

      if (!campaign) {
        return NextResponse.json(
          {
            success: false,
            error: `Campagne ${item.campaignId} introuvable.`,
          },
          { status: 404 }
        );
      }

      if (campaign.status !== "ACTIVE") {
        return NextResponse.json(
          {
            success: false,
            error: `La campagne ${campaign.product.name} n'est plus active.`,
          },
          { status: 400 }
        );
      }

      /*
       * Le prix est déterminé à partir de la quantité
       * commandée dans cette campagne.
       */
      const tier = campaign.priceTiers.find(
        (priceTier) =>
          item.quantity >= priceTier.minQuantity &&
          item.quantity <= priceTier.maxQuantity
      );

      /*
       * Si aucun palier ne correspond, on utilise
       * le premier palier comme sécurité.
       */
      const unitPrice =
        tier?.price ??
        campaign.priceTiers[0]?.price ??
        0;

      if (unitPrice <= 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Prix invalide pour ${campaign.product.name}.`,
          },
          { status: 400 }
        );
      }

      validatedItems.push({
        campaign,
        quantity: item.quantity,
        unitPrice,
        amount: item.quantity * unitPrice,
      });
    }

    const totalAmount = validatedItems.reduce(
      (total, item) => total + item.amount,
      0
    );

    const totalQuantity = validatedItems.reduce(
      (total, item) => total + item.quantity,
      0
    );

    /*
     * Le modèle Order possède encore des champs historiques
     * campaignId / quantity / unitPrice.
     *
     * Pour une commande multi-produits, on conserve le premier
     * article comme référence legacy.
     *
     * Les vrais détails de la commande sont stockés dans OrderItem.
     */
    const firstItem = validatedItems[0];

    /*
     * Création / récupération du client puis création
     * de la commande et de ses articles dans une transaction.
     */
    const result = await prisma.$transaction(async (tx) => {
      let user = await tx.user.findUnique({
        where: {
          phone,
        },
      });

      if (!user) {
        user = await tx.user.create({
          data: {
            name,
            phone,
            role: "CUSTOMER",
          },
        });
      } else if (user.name !== name) {
        user = await tx.user.update({
          where: {
            id: user.id,
          },
          data: {
            name,
          },
        });
      }

      const order = await tx.order.create({
        data: {
          userId: user.id,

          /*
           * Compatibilité avec le modèle historique.
           */
          campaignId: firstItem.campaign.id,
          quantity: totalQuantity,
          unitPrice: firstItem.unitPrice,

          /*
           * Montant réel de toute la commande.
           */
          amount: totalAmount,

          status: "PENDING",
        },
      });

      for (const item of validatedItems) {
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            campaignId: item.campaign.id,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.amount,
          },
        });

        /*
         * Ajouter la quantité à la campagne concernée.
         */
        await tx.campaign.update({
          where: {
            id: item.campaign.id,
          },
          data: {
            currentQuantity: {
              increment: item.quantity,
            },
          },
        });
      }

      /*
       * Créer la livraison dès la création de la commande.
       */
      await tx.delivery.create({
        data: {
          orderId: order.id,
          address,
          status: "PENDING",
        },
      });

      return order;
    });

    return NextResponse.json({
      success: true,
      orderId: result.id,
      amount: totalAmount,
    });
  } catch (error) {
    console.error("Erreur création commande :", error);

    return NextResponse.json(
      {
        success: false,
        error: "Impossible de créer la commande.",
      },
      { status: 500 }
    );
  }
}