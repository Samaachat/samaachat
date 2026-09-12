import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const id = Number(orderId);

    if (!Number.isInteger(id) || id < 1) {
      return NextResponse.json(
        { error: "Commande invalide." },
        { status: 400 }
      );
    }

    const orderToken = request.headers.get("x-order-token");

    if (!orderToken) {
      return NextResponse.json(
        { error: "Accès à la commande non autorisé." },
        { status: 403 }
      );
    }

    const order = await prisma.order.findUnique({
      where: {
        id,
      },
      include: {
        payment: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Commande introuvable." },
        { status: 404 }
      );
    }

    if (!order.accessToken || order.accessToken !== orderToken) {
      return NextResponse.json(
        { error: "Accès à la commande non autorisé." },
        { status: 403 }
      );
    }

    return NextResponse.json({
      orderId: order.id,
      orderStatus: order.status,
      paymentStatus: order.payment?.status ?? "PENDING",
      amount: order.amount,
    });
  } catch (error) {
    console.error("Erreur vérification paiement :", error);

    return NextResponse.json(
      { error: "Une erreur est survenue." },
      { status: 500 }
    );
  }
}