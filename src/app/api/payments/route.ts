import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const orderId = Number(body.orderId);
    const provider = String(body.provider ?? "TEST").trim().toUpperCase();

    // Pour l'instant, notre système accepte uniquement le paiement de test.
    if (provider !== "TEST") {
      return NextResponse.json(
        {
          error:
            "Mode de paiement non disponible pour le moment.",
        },
        { status: 400 }
      );
    }

    if (!Number.isInteger(orderId) || orderId < 1) {
      return NextResponse.json(
        { error: "Commande invalide." },
        { status: 400 }
      );
    }

    const order = await prisma.order.findUnique({
      where: {
        id: orderId,
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

    if (order.status === "CANCELLED") {
      return NextResponse.json(
        { error: "Cette commande est annulée." },
        { status: 400 }
      );
    }

    // Si le paiement est déjà confirmé, on ne le recrée pas.
    if (order.payment?.status === "PAID") {
      return NextResponse.json({
        success: true,
        message: "Cette commande est déjà payée.",
        paymentId: order.payment.id,
        orderId: order.id,
        amount: order.amount,
        status: "PAID",
      });
    }

    // Une commande déjà confirmée ne doit normalement plus être payée.
    if (order.status === "CONFIRMED") {
      return NextResponse.json(
        {
          error:
            "Cette commande est déjà confirmée.",
        },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.upsert({
        where: {
          orderId,
        },
        update: {
          amount: order.amount,
          provider: "TEST",
          status: "PAID",
        },
        create: {
          orderId,
          amount: order.amount,
          provider: "TEST",
          status: "PAID",
        },
      });

      const updatedOrder = await tx.order.update({
        where: {
          id: orderId,
        },
        data: {
          status: "CONFIRMED",
        },
      });

      return {
        payment,
        order: updatedOrder,
      };
    });

    return NextResponse.json({
      success: true,
      message: "Paiement confirmé.",
      paymentId: result.payment.id,
      orderId: result.order.id,
      amount: result.order.amount,
      status: result.payment.status,
    });
  } catch (error) {
    console.error("Erreur paiement :", error);

    return NextResponse.json(
      { error: "Une erreur est survenue." },
      { status: 500 }
    );
  }
}