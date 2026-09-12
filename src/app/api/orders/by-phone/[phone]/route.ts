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

    // ---------------------------------------------------------
    // 1. VÉRIFICATION DU TOKEN DE COMMANDE
    // ---------------------------------------------------------

    const orderToken = request.headers.get(
      "x-order-token"
    );

    if (!orderToken) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Accès aux commandes non autorisé.",
        },
        { status: 403 }
      );
    }

    // ---------------------------------------------------------
    // 2. RECHERCHE DE LA COMMANDE PAR TOKEN
    // ---------------------------------------------------------

    const order = await prisma.order.findUnique({
      where: {
        accessToken: orderToken,
      },
      include: {
        user: true,
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
    });

    if (!order) {
      return NextResponse.json(
        {
          success: false,
          error: "Commande introuvable.",
        },
        { status: 404 }
      );
    }

    // ---------------------------------------------------------
    // 3. VÉRIFICATION DU NUMÉRO DE TÉLÉPHONE
    // ---------------------------------------------------------

    if (order.user.phone !== cleanPhone) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Accès à la commande non autorisé.",
        },
        { status: 403 }
      );
    }

    // ---------------------------------------------------------
    // 4. FORMATAGE DE LA COMMANDE
    // ---------------------------------------------------------

    const formattedOrder = {
      id: order.id,

      product:
        order.items.length > 1
          ? `${order.items.length} produits`
          : order.campaign.product.name,

      quantity: order.quantity,
      unitPrice: order.unitPrice,
      amount: order.amount,

      finalUnitPrice:
        order.finalUnitPrice,

      finalAmount:
        order.finalAmount,

      status: order.status,

      paymentStatus:
        order.payment?.status ??
        "PENDING",

      createdAt: order.createdAt,

      items: order.items.map(
        (item) => ({
          campaignId:
            item.campaignId,

          product:
            item.campaign.product.name,

          quantity:
            item.quantity,

          unitPrice:
            item.unitPrice,

          amount:
            item.amount,
        })
      ),
    };

    // ---------------------------------------------------------
    // 5. RÉPONSE
    // ---------------------------------------------------------

    return NextResponse.json({
      success: true,
      orders: [formattedOrder],
    });
  } catch (error) {
    console.error(
      "Erreur recherche commandes :",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Impossible de récupérer les commandes.",
      },
      { status: 500 }
    );
  }
}