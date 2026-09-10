import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const allowedStatuses = [
  "PENDING",
  "CONFIRMED",
  "DELIVERED",
  "CANCELLED",
] as const;

type AllowedStatus = (typeof allowedStatuses)[number];

export async function PATCH(request: Request) {
  try {
    const body = await request.json();

    const orderId = Number(body.orderId);
    const status = String(body.status ?? "")
      .trim()
      .toUpperCase() as AllowedStatus;

    if (!Number.isInteger(orderId) || orderId < 1) {
      return NextResponse.json(
        { error: "Commande invalide." },
        { status: 400 }
      );
    }

    if (!allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: "Statut de commande invalide." },
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

    if (order.status === "CANCELLED" && status !== "CANCELLED") {
      return NextResponse.json(
        {
          error:
            "Une commande annulée ne peut pas être réactivée.",
        },
        { status: 400 }
      );
    }

    if (order.status === "DELIVERED" && status !== "DELIVERED") {
      return NextResponse.json(
        {
          error:
            "Une commande déjà livrée ne peut pas revenir à un autre statut.",
        },
        { status: 400 }
      );
    }

    // Une commande ne peut être confirmée que si le paiement est PAID.
    if (status === "CONFIRMED" && order.payment?.status !== "PAID") {
      return NextResponse.json(
        {
          error:
            "Paiement requis avant de confirmer la commande.",
        },
        { status: 400 }
      );
    }

    const updatedOrder = await prisma.order.update({
      where: {
        id: orderId,
      },
      data: {
        status,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Statut de la commande mis à jour.",
      order: {
        id: updatedOrder.id,
        status: updatedOrder.status,
      },
    });
  } catch (error) {
    console.error("Erreur changement statut commande :", error);

    return NextResponse.json(
      { error: "Une erreur est survenue." },
      { status: 500 }
    );
  }
}