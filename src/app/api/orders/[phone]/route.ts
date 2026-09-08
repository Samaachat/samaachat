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
      orderBy: {
        createdAt: "desc",
      },
    });

    const ordersWithDetails = orders.map((order) => {
      return {
        id: order.id,

        status: order.status,

        paymentStatus:
          order.payment?.status ?? "PENDING",

        amount: order.amount,

        finalAmount: order.finalAmount,

        createdAt: order.createdAt,

        items: order.items.map((item) => ({
          campaignId: item.campaignId,

          product:
            item.campaign.product.name,

          unit:
            item.campaign.product.unit,

          quantity:
            item.quantity,

          unitPrice:
            item.unitPrice,

          amount:
            item.amount,
        })),
      };
    });

    return NextResponse.json({
      orders: ordersWithDetails,
    });
  } catch (error) {
    console.error(
      "Erreur récupération commandes :",
      error
    );

    return NextResponse.json(
      {
        error:
          "Une erreur est survenue.",
      },
      {
        status: 500,
      }
    );
  }
}