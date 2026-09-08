import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const campaign = await prisma.campaign.findFirst({
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
    });

    const orders = await prisma.order.findMany({
      include: {
        user: true,
        payment: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

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
      (total, order) => total + order.amount,
      0
    );

    return NextResponse.json({
      campaign: campaign
        ? {
            id: campaign.id,
            product: campaign.product.name,
            currentQuantity: campaign.currentQuantity,
            targetQuantity: campaign.targetQuantity,
            priceTiers: campaign.priceTiers,
          }
        : null,

      statistics: {
        customers,
        orders: orders.length,
        paidOrders: paidOrders.length,
        totalQuantity,
        totalRevenue,
      },

      orders: orders.map((order) => ({
        id: order.id,
        customer: order.user.name,
        phone: order.user.phone,
        quantity: order.quantity,
        unitPrice: order.unitPrice,
        amount: order.amount,
        orderStatus: order.status,
        paymentStatus: order.payment?.status ?? "PENDING",
        createdAt: order.createdAt,
      })),
    });
  } catch (error) {
    console.error("Erreur dashboard admin :", error);

    return NextResponse.json(
      { error: "Une erreur est survenue." },
      { status: 500 }
    );
  }
}