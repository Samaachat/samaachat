import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{
      phone: string;
    }>;
  }
) {
  try {
    const { phone } = await context.params;

    const cleanPhone = decodeURIComponent(phone)
      .replace(/\s/g, "")
      .trim();

    if (!cleanPhone) {
      return NextResponse.json(
        {
          success: false,
          error: "Numéro de téléphone invalide.",
        },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: {
        phone: cleanPhone,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Commande introuvable.",
        },
        { status: 404 }
      );
    }

    const orders = await prisma.order.findMany({
      where: {
        userId: user.id,
      },
      include: {
        campaign: {
          include: {
            product: true,
          },
        },
        payment: true,
        items: {
          include: {
            campaign: {
              include: {
                product: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const formattedOrders = orders.map((order) => ({
      id: order.id,

      product:
        order.items.length > 1
          ? `${order.items.length} produits`
          : order.campaign.product.name,

      quantity: order.quantity,
      unitPrice: order.unitPrice,
      amount: order.amount,

      finalUnitPrice: order.finalUnitPrice,
      finalAmount: order.finalAmount,

      status: order.status,

      paymentStatus:
        order.payment?.status ?? "PENDING",

      createdAt: order.createdAt,

      items: order.items.map((item) => ({
        campaignId: item.campaignId,
        product: item.campaign.product.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
      })),
    }));

    return NextResponse.json({
      success: true,
      orders: formattedOrders,
    });
  } catch (error) {
    console.error("Erreur recherche commandes :", error);

    return NextResponse.json(
      {
        success: false,
        error: "Impossible de récupérer les commandes.",
      },
      { status: 500 }
    );
  }
}