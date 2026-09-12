import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminFromRequest } from "@/lib/admin-auth";
import { getCampaignUnitPrice } from "@/lib/campaign-prices";

export async function POST(request: Request) {
  try {
    const admin = await getAdminFromRequest(request);

    if (!admin) {
      return NextResponse.json(
        { success: false, error: "Accès administrateur requis." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => null);
    const campaignId = Number(body?.campaignId);

    if (!Number.isInteger(campaignId) || campaignId < 1) {
      return NextResponse.json(
        { success: false, error: "Campagne invalide." },
        { status: 400 }
      );
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        product: true,
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campagne introuvable." },
        { status: 404 }
      );
    }

    if (campaign.status !== "ACTIVE") {
      return NextResponse.json(
        { success: false, error: "Cette campagne n'est plus active." },
        { status: 400 }
      );
    }

    const finalUnitPrice = getCampaignUnitPrice(campaign.product.name);

    if (finalUnitPrice <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Aucun prix fixe configuré pour ${campaign.product.name}.`,
        },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const items = await tx.orderItem.findMany({
        where: {
          campaignId,
        },
        select: {
          id: true,
          orderId: true,
          quantity: true,
        },
      });

      await tx.orderItem.updateMany({
        where: {
          campaignId,
        },
        data: {
          unitPrice: finalUnitPrice,
        },
      });

      const orderIds = [...new Set(items.map((item) => item.orderId))];

      for (const orderId of orderIds) {
        const orderItems = await tx.orderItem.findMany({
          where: { orderId },
          select: {
            quantity: true,
            unitPrice: true,
          },
        });

        const amount = orderItems.reduce(
          (total, item) => total + item.quantity * item.unitPrice,
          0
        );

        await tx.order.update({
          where: { id: orderId },
          data: { amount },
        });
      }

      await tx.campaign.update({
        where: { id: campaignId },
        data: { status: "COMPLETED" },
      });

      return {
        ordersUpdated: orderIds.length,
      };
    });

    return NextResponse.json({
      success: true,
      finalUnitPrice,
      ordersUpdated: result.ordersUpdated,
    });
  } catch (error) {
    console.error("Erreur clôture campagne :", error);

    return NextResponse.json(
      {
        success: false,
        error: "Impossible de clôturer la campagne.",
      },
      { status: 500 }
    );
  }
}
