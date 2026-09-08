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