import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const campaignId = Number(id);

    if (!Number.isInteger(campaignId) || campaignId < 1) {
      return NextResponse.json(
        { error: "Campagne invalide." },
        { status: 400 }
      );
    }

    const campaign = await prisma.campaign.findUnique({
      where: {
        id: campaignId,
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

    if (!campaign || campaign.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Campagne introuvable." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      campaign: {
        id: campaign.id,
        product: {
          name: campaign.product.name,
        },
        currentQuantity: campaign.currentQuantity,
        targetQuantity: campaign.targetQuantity,
        priceTiers: campaign.priceTiers.map((tier) => ({
          id: tier.id,
          minQuantity: tier.minQuantity,
          maxQuantity: tier.maxQuantity,
          price: tier.price,
        })),
      },
    });
  } catch (error) {
    console.error("Erreur récupération campagne :", error);

    return NextResponse.json(
      { error: "Une erreur est survenue." },
      { status: 500 }
    );
  }
}