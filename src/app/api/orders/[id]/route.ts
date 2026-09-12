import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const orderId = Number(id);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return NextResponse.json(
        { error: "Commande invalide." },
        { status: 400 }
      );
    }

    const token = request.headers.get("x-order-token");

    if (!token) {
      return NextResponse.json(
        { error: "Accès à la commande non autorisé." },
        { status: 403 }
      );
    }

    const order = await prisma.order.findUnique({
      where: {
        id: orderId,
      },
      include: {
        campaign: {
          include: {
            product: true,
          },
        },
        items: {
          include: {
            campaign: {
              include: {
                product: true,
              },
            },
          },
        },
        payment: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Commande introuvable." },
        { status: 404 }
      );
    }

    if (!order.accessToken || order.accessToken !== token) {
      return NextResponse.json(
        { error: "Accès à la commande non autorisé." },
        { status: 403 }
      );
    }

    const items = order.items.map((item) => ({
      campaignId: item.campaignId,
      product: item.campaign.product.name,
      unit: item.campaign.product.unit,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: item.amount,
    }));

    return NextResponse.json({
      id: order.id,
      amount: order.amount,
      finalAmount: order.finalAmount,
      status: order.status,
      paymentStatus: order.payment?.status ?? "PENDING",
      items,
    });
  } catch (error) {
    console.error(
      "Erreur récupération détail commande :",
      error
    );

    return NextResponse.json(
      {
        error: "Une erreur est survenue.",
      },
      {
        status: 500,
      }
    );
  }
}