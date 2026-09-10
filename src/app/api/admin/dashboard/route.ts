import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const campaigns = await prisma.campaign.findMany({
      where: {
        status: "ACTIVE",
      },
      include: {
        product: true,
        priceTiers: {
          orderBy: {
            minQuantity: "asc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const orders = await prisma.order.findMany({
      include: {
        user: true,
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

    const deliveries = await prisma.delivery.findMany();

    const deliveryMap = new Map(
      deliveries.map((delivery) => [delivery.orderId, delivery])
    );

    const customers = await prisma.user.count({
      where: {
        role: "CUSTOMER",
      },
    });

    const paidOrders = orders.filter(
      (order) => order.payment?.status === "PAID"
    );

    const totalQuantity = orders.reduce(
      (total, order) => total + order.quantity,
      0
    );

    const totalRevenue = paidOrders.reduce(
      (total, order) => total + (order.finalAmount ?? order.amount),
      0
    );

    return NextResponse.json({
      campaigns: campaigns.map((campaign) => ({
        id: campaign.id,
        product: campaign.product.name,
        unit: campaign.product.unit,
        currentQuantity: campaign.currentQuantity,
        targetQuantity: campaign.targetQuantity,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        priceTiers: campaign.priceTiers,
      })),

      // Compatibilité temporaire avec l'ancien dashboard.
      campaign: campaigns[0]
        ? {
            id: campaigns[0].id,
            product: campaigns[0].product.name,
            unit: campaigns[0].product.unit,
            currentQuantity: campaigns[0].currentQuantity,
            targetQuantity: campaigns[0].targetQuantity,
            priceTiers: campaigns[0].priceTiers,
          }
        : null,

      statistics: {
        customers,
        orders: orders.length,
        paidOrders: paidOrders.length,
        totalQuantity,
        totalRevenue,
      },

      orders: orders.map((order) => {
        const delivery = deliveryMap.get(order.id);

        return {
          id: order.id,
          customer: order.user.name,
          phone: order.user.phone,
          quantity: order.quantity,
          unitPrice: order.unitPrice,
          finalUnitPrice: order.finalUnitPrice,
          amount: order.amount,
          finalAmount: order.finalAmount,
          orderStatus: order.status,
          paymentStatus: order.payment?.status ?? "PENDING",

          items: order.items.map((item) => ({
            campaignId: item.campaignId,
            product: item.campaign.product.name,
            unit: item.campaign.product.unit,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.amount,
          })),

          address: delivery?.address ?? "",
          deliveryStatus: delivery?.status ?? "PENDING",
          deliveryDate: delivery?.deliveryDate ?? null,

          createdAt: order.createdAt,
        };
      }),
    });
  } catch (error) {
    console.error("Erreur dashboard admin :", error);

    return NextResponse.json(
      {
        error: "Une erreur est survenue.",
        details: String(error),
      },
      { status: 500 }
    );
  }
}