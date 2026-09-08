import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type OrderItemInput = {
  campaignId: number;
  quantity: number;
};

type CalculatedItem = {
  campaignId: number;
  quantity: number;
  unitPrice: number;
  amount: number;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const name = String(body.name ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const address = String(body.address ?? "").trim();

    const rawItems: unknown[] = Array.isArray(body.items)
      ? body.items
      : [];

    if (!name || !phone || !address || rawItems.length === 0) {
      return NextResponse.json(
        {
          error:
            "Veuillez renseigner votre nom, votre téléphone, votre adresse et au moins un produit.",
        },
        { status: 400 }
      );
    }

    /*
     * On ne fait confiance qu'à campaignId et quantity.
     * Le prix envoyé par le navigateur est volontairement ignoré.
     */
    const items: OrderItemInput[] = rawItems.map((item) => {
      const data = item as Record<string, unknown>;

      return {
        campaignId: Number(data.campaignId),
        quantity: Number(data.quantity),
      };
    });

    /*
     * Vérifications de base.
     */
    const invalidItem = items.some(
      (item) =>
        !Number.isInteger(item.campaignId) ||
        item.campaignId < 1 ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1
    );

    if (invalidItem) {
      return NextResponse.json(
        {
          error: "Un produit ou une quantité est invalide.",
        },
        { status: 400 }
      );
    }

    /*
     * Une campagne ne peut apparaître qu'une seule fois
     * dans une même commande.
     */
    const uniqueCampaignIds = new Set(
      items.map((item) => item.campaignId)
    );

    if (uniqueCampaignIds.size !== items.length) {
      return NextResponse.json(
        {
          error:
            "Un même produit ne peut pas être sélectionné plusieurs fois.",
        },
        { status: 400 }
      );
    }

    const campaignIds = items.map(
      (item) => item.campaignId
    );

    /*
     * On récupère les campagnes directement depuis la base.
     *
     * Le client ne peut donc pas imposer :
     * - le prix ;
     * - le statut de la campagne ;
     * - la quantité actuelle.
     */
    const campaigns = await prisma.campaign.findMany({
      where: {
        id: {
          in: campaignIds,
        },
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

    /*
     * Toutes les campagnes demandées doivent exister
     * et être encore actives.
     */
    if (campaigns.length !== items.length) {
      return NextResponse.json(
        {
          error:
            "Un des produits sélectionnés n'est plus disponible.",
        },
        { status: 400 }
      );
    }

    /*
     * Calcul du prix côté serveur.
     */
    const calculatedItems: CalculatedItem[] = [];

    for (const item of items) {
      const campaign = campaigns.find(
        (campaign) =>
          campaign.id === item.campaignId
      );

      if (!campaign) {
        return NextResponse.json(
          {
            error:
              "Une des campagnes sélectionnées est introuvable.",
          },
          { status: 400 }
        );
      }

      /*
       * Quantité totale de la campagne après cette commande.
       */
      const newQuantity =
        campaign.currentQuantity +
        item.quantity;

      /*
       * On interdit de dépasser l'objectif
       * de la campagne.
       */
      if (newQuantity > campaign.targetQuantity) {
        return NextResponse.json(
          {
            error:
              `La quantité disponible pour ${campaign.product.name} ` +
              `est insuffisante. Il reste seulement ` +
              `${Math.max(
                campaign.targetQuantity -
                  campaign.currentQuantity,
                0
              )} unité(s) disponible(s).`,
          },
          { status: 400 }
        );
      }

      /*
       * Le prix doit obligatoirement correspondre
       * à un palier valide.
       *
       * Aucun prix de secours n'est utilisé.
       */
      const priceTier =
        campaign.priceTiers.find(
          (tier) =>
            newQuantity >= tier.minQuantity &&
            newQuantity <= tier.maxQuantity
        );

      if (!priceTier) {
        return NextResponse.json(
          {
            error:
              `Aucun palier de prix ne correspond ` +
              `à la quantité prévue pour ${campaign.product.name}.`,
          },
          { status: 400 }
        );
      }

      const unitPrice = priceTier.price;

      const amount =
        item.quantity * unitPrice;

      calculatedItems.push({
        campaignId: campaign.id,
        quantity: item.quantity,
        unitPrice,
        amount,
      });
    }

    /*
     * Total de la commande.
     */
    const totalAmount =
      calculatedItems.reduce(
        (total, item) =>
          total + item.amount,
        0
      );

    const totalQuantity =
      calculatedItems.reduce(
        (total, item) =>
          total + item.quantity,
        0
      );

    /*
     * Création ou récupération du client.
     */
    const user = await prisma.user.upsert({
      where: {
        phone,
      },
      update: {
        name,
      },
      create: {
        name,
        phone,
        role: "CUSTOMER",
      },
    });

    /*
     * Création atomique de la commande.
     *
     * Si une opération échoue :
     * - la commande n'est pas créée ;
     * - les OrderItem ne sont pas créés ;
     * - les quantités de campagne ne sont pas augmentées ;
     * - la livraison n'est pas créée.
     */
    const result = await prisma.$transaction(
      async (tx) => {
        const firstItem =
          calculatedItems[0];

        /*
         * Le modèle Order actuel conserve
         * campaignId / quantity / unitPrice / amount
         * pour compatibilité.
         *
         * Les détails complets sont dans OrderItem.
         */
        const order =
          await tx.order.create({
            data: {
              userId: user.id,

              campaignId:
                firstItem.campaignId,

              quantity:
                totalQuantity,

              unitPrice:
                firstItem.unitPrice,

              amount:
                totalAmount,
            },
          });

        /*
         * Création de chaque ligne de commande.
         */
        for (const item of calculatedItems) {
          await tx.orderItem.create({
            data: {
              orderId:
                order.id,

              campaignId:
                item.campaignId,

              quantity:
                item.quantity,

              unitPrice:
                item.unitPrice,

              amount:
                item.amount,
            },
          });

          /*
           * Mise à jour de la quantité
           * de la campagne.
           */
          await tx.campaign.update({
            where: {
              id: item.campaignId,
            },
            data: {
              currentQuantity: {
                increment:
                  item.quantity,
              },
            },
          });
        }

        /*
         * Création de la livraison.
         */
        await tx.delivery.create({
          data: {
            orderId:
              order.id,

            address,

            status:
              "PENDING",
          },
        });

        return order;
      }
    );

    /*
     * Réponse au navigateur.
     */
    return NextResponse.json({
      success: true,

      orderId:
        result.id,

      amount:
        totalAmount,

      items:
        calculatedItems,
    });
  } catch (error) {
    console.error(
      "Erreur création commande :",
      error
    );

    return NextResponse.json(
      {
        error:
          "Une erreur est survenue.",
      },
      { status: 500 }
    );
  }
}