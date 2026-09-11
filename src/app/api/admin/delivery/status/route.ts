import { getAdminFromRequest } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const allowedStatuses = [
  "PENDING",
  "PREPARING",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
] as const;

type DeliveryStatus = (typeof allowedStatuses)[number];

const nextStatus: Record<
  Exclude<DeliveryStatus, "DELIVERED">,
  DeliveryStatus
> = {
  PENDING: "PREPARING",
  PREPARING: "OUT_FOR_DELIVERY",
  OUT_FOR_DELIVERY: "DELIVERED",
};

export async function PATCH(request: Request) {
  try {
    const admin = await getAdminFromRequest(request);

    if (!admin) {
      return NextResponse.json(
        { error: "Accès administrateur requis." },
        { status: 401 }
      );
    }

    const body = await request.json();

    const orderId = Number(body.orderId);
    const status = String(body.status ?? "")
      .trim()
      .toUpperCase() as DeliveryStatus;

    if (!Number.isInteger(orderId) || orderId < 1) {
      return NextResponse.json(
        { error: "Commande invalide." },
        { status: 400 }
      );
    }

    if (!allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: "Statut de livraison invalide." },
        { status: 400 }
      );
    }

    const delivery = await prisma.delivery.findUnique({
      where: {
        orderId,
      },
      include: {
        order: true,
      },
    });

    if (!delivery) {
      return NextResponse.json(
        {
          error:
            "Aucune livraison trouvée pour cette commande.",
        },
        { status: 404 }
      );
    }

    if (delivery.order.status === "CANCELLED") {
      return NextResponse.json(
        {
          error:
            "Une commande annulée ne peut pas être livrée.",
        },
        { status: 400 }
      );
    }

    if (
      status === "PREPARING" &&
      delivery.order.status !== "CONFIRMED"
    ) {
      return NextResponse.json(
        {
          error:
            "La commande doit être confirmée avant sa préparation.",
        },
        { status: 400 }
      );
    }

    if (delivery.status === "DELIVERED") {
      return NextResponse.json(
        {
          error:
            "Une livraison déjà terminée ne peut pas être modifiée.",
        },
        { status: 400 }
      );
    }

    if (
      delivery.status !== status &&
      nextStatus[
        delivery.status as Exclude<DeliveryStatus, "DELIVERED">
      ] !== status
    ) {
      return NextResponse.json(
        {
          error:
            `Transition de livraison invalide : ${delivery.status} → ${status}.`,
        },
        { status: 400 }
      );
    }

    const updatedDelivery = await prisma.$transaction(
      async (tx) => {
        const updated = await tx.delivery.update({
          where: {
            orderId,
          },
          data: {
            status,
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
      }
    );

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
      },
      { status: 500 }
    );
  }
}