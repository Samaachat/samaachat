import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

type OrderItemInput = {
  campaignId: number;
  quantity: number;
  price?: number;
};

const MAX_QUANTITY_PER_ITEM = 100;

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

      if (item.quantity > MAX_QUANTITY_PER_ITEM) {
        return NextResponse.json(
          {
            success: false,
            error: `La quantité maximale est de ${MAX_QUANTITY_PER_ITEM} unités par produit.`,
          },
          { status: 400 }
        );
      }
    }

    /*
     * Empêcher qu'une même campagne soit envoyée plusieurs fois.
     */
    const campaignIds = items.map(
      (item) => item.campaignId
    );

    if (
      new Set(campaignIds).size !== campaignIds.length
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Un produit ne peut apparaître qu'une seule fois.",
        },
        { status: 400 }
      );
    }

    /*
     * Récupérer les campagnes demandées.
     *
     * Le prix est recalculé côté serveur.
     * On ne fait donc jamais confiance au prix
     * envoyé par le navigateur.
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

    if (
      campaigns.length !== campaignIds.length
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Une ou plusieurs campagnes sont introuvables.",
        },
        { status: 404 }
      );
    }

    /*
     * Vérification des campagnes et calcul des prix.
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
       * Vérification simple avant la transaction.
       */
      const remainingQuantity =
        campaign.targetQuantity -
        campaign.currentQuantity;

      if (item.quantity > remainingQuantity) {
        return NextResponse.json(
          {
            success: false,
            error:
              `Il ne reste que ${Math.max(
                remainingQuantity,
                0
              )} unité(s) disponible(s) pour ${campaign.product.name}.`,
          },
          { status: 400 }
        );
      }

      /*
       * Déterminer le prix à partir des paliers.
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
            error:
              `Prix invalide pour ${campaign.product.name}.`,
          },
          { status: 400 }
        );
      }

      validatedItems.push({
        campaign,
        quantity: item.quantity,
        unitPrice,
        amount:
          item.quantity * unitPrice,
      });
    }

    const totalAmount =
      validatedItems.reduce(
        (total, item) =>
          total + item.amount,
        0
      );

    const totalQuantity =
      validatedItems.reduce(
        (total, item) =>
          total + item.quantity,
        0
      );

    /*
     * Compatibilité avec le modèle Order historique.
     */
    const firstItem = validatedItems[0];

    /*
     * Token secret permettant de prouver la possession
     * de la commande.
     */
    const accessToken = crypto.randomBytes(32).toString("hex");

    /*
     * Création de la commande dans une transaction.
     *
     * On re-vérifie la capacité des campagnes
     * à l'intérieur de la transaction avant
     * d'incrémenter currentQuantity.
     */
    const result =
      await prisma.$transaction(
        async (tx) => {
          for (const item of validatedItems) {
            const currentCampaign =
              await tx.campaign.findUnique({
                where: {
                  id: item.campaign.id,
                },
              });

            if (!currentCampaign) {
              throw new Error(
                `Campagne ${item.campaign.id} introuvable.`
              );
            }

            if (
              currentCampaign.status !==
              "ACTIVE"
            ) {
              throw new Error(
                `La campagne ${currentCampaign.productId} n'est plus active.`
              );
            }

            const remaining =
              currentCampaign.targetQuantity -
              currentCampaign.currentQuantity;

            if (item.quantity > remaining) {
              throw new Error(
                `CAPACITY:${item.campaign.id}:${Math.max(
                  remaining,
                  0
                )}`
              );
            }
          }

          let user =
            await tx.user.findUnique({
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
          } else if (
            user.name !== name
          ) {
            user =
              await tx.user.update({
                where: {
                  id: user.id,
                },
                data: {
                  name,
                },
              });
          }

          const order =
            await tx.order.create({
              data: {
                accessToken,
                userId: user.id,

                /*
                 * Compatibilité avec le modèle historique.
                 */
                campaignId:
                  firstItem.campaign.id,
                quantity: totalQuantity,
                unitPrice:
                  firstItem.unitPrice,

                /*
                 * Montant réel de toute
                 * la commande.
                 */
                amount: totalAmount,

                status: "PENDING",
              },
            });

          for (const item of validatedItems) {
            await tx.orderItem.create({
              data: {
                orderId: order.id,
                campaignId:
                  item.campaign.id,
                quantity: item.quantity,
                unitPrice:
                  item.unitPrice,
                amount: item.amount,
              },
            });

            await tx.campaign.update({
              where: {
                id: item.campaign.id,
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
           * Créer la livraison dès
           * la création de la commande.
           */
          await tx.delivery.create({
            data: {
              orderId: order.id,
              address,
              status: "PENDING",
            },
          });

          return order;
        }
      );

    return NextResponse.json({
      success: true,
      orderId: result.id,
      accessToken,
      amount: totalAmount,
    });
  } catch (error) {
    console.error(
      "Erreur création commande :",
      error
    );

    if (
      error instanceof Error &&
      error.message.startsWith("CAPACITY:")
    ) {
      const parts =
        error.message.split(":");

      const campaignId = Number(
        parts[1]
      );

      const remaining = Number(
        parts[2]
      );

      return NextResponse.json(
        {
          success: false,
          error:
            `La quantité demandée n'est plus disponible. Il reste ${remaining} unité(s) pour cette campagne.`,
          campaignId,
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          "Impossible de créer la commande.",
      },
      { status: 500 }
    );
  }
}