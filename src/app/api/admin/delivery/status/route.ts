import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const allowedStatuses = [
  "PENDING",
  "PREPARING",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
] as const;

export async function PATCH(request: Request) {
  try {
    const body = await request.json();

    const orderId = Number(body.orderId);
    const status = String(body.status ?? "");

    if (
      !Number.isInteger(orderId) ||
      !allowedStatuses.includes(status as never)
    ) {
      return NextResponse.json(
        { error: "Données invalides." },
        { status: 400 }
      );
    }

    const delivery = await prisma.delivery.findUnique({
      where: {
        orderId,
      },
    });

    if (!delivery) {
      return NextResponse.json(
        { error: "Aucune livraison trouvée pour cette commande." },
        { status: 404 }
      );
    }

    const updatedDelivery = await prisma.$transaction(async (tx) => {
      const updated = await tx.delivery.update({
        where: {
          orderId,
        },
        data: {
          status: status as
            | "PENDING"
            | "PREPARING"
            | "OUT_FOR_DELIVERY"
            | "DELIVERED",
          deliveryDate:
            status === "DELIVERED"
              ? delivery.deliveryDate ?? new Date()
              : delivery.deliveryDate,
        },
      });

      if (status === "DELIVERED") {
        await tx.order.update({
          where: {
            id: orderId,
          },
          data: {
            status: "DELIVERED",
          },
        });
      }

      return updated;
    });

    return NextResponse.json({
      success: true,
      delivery: {
        orderId: updatedDelivery.orderId,
        status: updatedDelivery.status,
        deliveryDate: updatedDelivery.deliveryDate,
      },
    });
  } catch (error) {
    console.error("Erreur statut livraison :", error);

    return NextResponse.json(
      {
        error: "Une erreur est survenue.",
        details: String(error),
      },
      { status: 500 }
    );
  }
}