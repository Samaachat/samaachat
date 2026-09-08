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
        { error: "Veuillez renseigner toutes les informations." },
        { status: 400 }
      );
    }

    const items: OrderItemInput[] = rawItems.map((item) => {
      const data = item as Record<string, unknown>;

      return {
        campaignId: Number(data.campaignId),
        quantity: Number(data.quantity),
      };
    });

    const invalidItem = items.some(
      (item) =>
        !Number.isInteger(item.campaignId) ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1
    );

    if (invalidItem) {
      return NextResponse.json(
        { error: "Un produit ou une quantité est invalide." },
        { status: 400 }
      );
    }

    const campaignIds = items.map((item) => item.campaignId);

    const campaigns = await prisma.campaign.findMany({
      where: {
        id: {
          in: campaignIds,
        },
        status: "ACTIVE",
      },
      include: {
        priceTiers: {
          orderBy: {
            minQuantity: "asc",
          },
        },
      },
    });

    if (campaigns.length !== items.length) {
      return NextResponse.json(
        {
          error:
            "Un des produits sélectionnés n'est plus disponible.",
        },
        { status: 400 }
      );
    }

    const calculatedItems: CalculatedItem[] = items.map((item) => {
      const campaign = campaigns.find(
        (campaign) => campaign.id === item.campaignId
      );

      if (!campaign) {
        throw new Error("Campagne introuvable.");
      }

      const newQuantity =
        campaign.currentQuantity + item.quantity;

      const priceTier =
        campaign.priceTiers.find(
          (tier) =>
            newQuantity >= tier.minQuantity &&
            newQuantity <= tier.maxQuantity
        ) ?? campaign.priceTiers[0];

      if (!priceTier) {
        throw new Error(
          `Aucun prix disponible pour la campagne ${campaign.id}.`
        );
      }

      const unitPrice = priceTier.price;
      const amount = item.quantity * unitPrice;

      return {
        campaignId: campaign.id,
        quantity: item.quantity,
        unitPrice,
        amount,
      };
    });

    const totalAmount = calculatedItems.reduce(
      (total, item) => total + item.amount,
      0
    );

    const totalQuantity = calculatedItems.reduce(
      (total, item) => total + item.quantity,
      0
    );

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
      },
    });

    const result = await prisma.$transaction(async (tx) => {
      const firstItem = calculatedItems[0];

      const order = await tx.order.create({
        data: {
          userId: user.id,
          campaignId: firstItem.campaignId,
          quantity: totalQuantity,
          unitPrice: firstItem.unitPrice,
          amount: totalAmount,
        },
      });

      for (const item of calculatedItems) {
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            campaignId: item.campaignId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.amount,
          },
        });

        await tx.campaign.update({
          where: {
            id: item.campaignId,
          },
          data: {
            currentQuantity: {
              increment: item.quantity,
            },
          },
        });
      }

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
      items: calculatedItems,
    });
  } catch (error) {
    console.error("Erreur création commande :", error);

    return NextResponse.json(
      { error: "Une erreur est survenue." },
      { status: 500 }
    );
  }
}