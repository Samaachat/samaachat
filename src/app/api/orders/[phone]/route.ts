import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ phone: string }> }
) {
  try {
    const { phone } = await params;

    const user = await prisma.user.findUnique({
      where: {
        phone,
      },
    });

    if (!user) {
      return NextResponse.json({
        orders: [],
      });
    }

    const orders = await prisma.order.findMany({
      where: {
        userId: user.id,
      },
      include: {
        campaign: {
          include: {
            product: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const ordersWithPayment = await Promise.all(
      orders.map(async (order) => {
        const payment = await prisma.payment.findUnique({
          where: {
            orderId: order.id,
          },
        });

        return {
          id: order.id,
          product: order.campaign.product.name,
          quantity: order.quantity,
          unitPrice: order.unitPrice,
          amount: order.amount,
          finalUnitPrice: order.finalUnitPrice,
          finalAmount: order.finalAmount,
          status: order.status,
          paymentStatus: payment?.status ?? "PENDING",
          createdAt: order.createdAt,
        };
      })
    );

    return NextResponse.json({
      orders: ordersWithPayment,
    });
  } catch (error) {
    console.error("Erreur récupération commandes :", error);

    return NextResponse.json(
      { error: "Une erreur est survenue." },
      { status: 500 }
    );
  }
}