export const CAMPAIGN_PRICES: Record<string, number> = {
  riz: 14500,
  huile: 4500,
  oignon: 8000,
  sucre: 12500,
  pommeDeTerre: 7500,
};

export function getCampaignUnitPrice(productName: string): number {
  const name = productName.toLowerCase();

  if (name.includes("riz")) return CAMPAIGN_PRICES.riz;
  if (name.includes("huile")) return CAMPAIGN_PRICES.huile;
  if (name.includes("oignon")) return CAMPAIGN_PRICES.oignon;
  if (name.includes("sucre")) return CAMPAIGN_PRICES.sucre;
  if (name.includes("pomme") || name.includes("terre")) {
    return CAMPAIGN_PRICES.pommeDeTerre;
  }

  return 0;
}
