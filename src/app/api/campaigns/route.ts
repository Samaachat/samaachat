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

    return NextResponse.json({
      campaigns,
    });
  } catch (error) {
    console.error("Erreur récupération campagnes :", error);

    return NextResponse.json(
      {
        error: "Impossible de récupérer les campagnes.",
      },
      { status: 500 }
    );
  }
}