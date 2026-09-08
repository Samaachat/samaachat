import { prisma } from "./prisma";

export async function getActiveCampaign() {
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

  return campaign;
}

export async function getActiveCampaigns() {
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

  return campaigns;
}