import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function CampagneDetailPage({ params }: Props) {
  const { id } = await params;
  const campaignId = Number(id);

  if (!Number.isInteger(campaignId) || campaignId < 1) {
    notFound();
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
    notFound();
  }

  const progress =
    campaign.targetQuantity > 0
      ? Math.min(
          100,
          Math.round(
            (campaign.currentQuantity / campaign.targetQuantity) * 100
          )
        )
      : 0;

  const currentTier =
    campaign.priceTiers
      .filter(
        (tier) =>
          campaign.currentQuantity >= tier.minQuantity &&
          campaign.currentQuantity <= tier.maxQuantity
      )
      .at(0) ?? campaign.priceTiers.at(0);

  const nextTier = campaign.priceTiers
    .filter((tier) => tier.minQuantity > campaign.currentQuantity)
    .at(0);

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link
            href="/"
            className="text-2xl font-black text-green-700"
          >
            SamaAchat
          </Link>

          <Link
            href="/campagnes"
            className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700"
          >
            ← Campagnes
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Produit */}
          <div>
            <div className="flex min-h-[360px] items-center justify-center rounded-3xl bg-green-50">
              <span className="text-9xl">🛒</span>
            </div>

            <div className="mt-6">
              <p className="font-bold text-yellow-600">
                ACHAT GROUPÉ
              </p>

              <h1 className="mt-2 text-4xl font-black text-slate-900">
                {campaign.product.name}
              </h1>

              <p className="mt-4 text-lg leading-7 text-slate-600">
                Plus nous sommes nombreux à commander, plus le prix
                peut baisser.
              </p>
            </div>
          </div>

          {/* Informations campagne */}
          <div>
            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-bold text-green-700">
                  Campagne active
                </span>

                <span className="text-sm font-bold text-slate-500">
                  #{campaign.id}
                </span>
              </div>

              <div className="mt-8">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-500">
                      COMMANDES ACTUELLES
                    </p>

                    <p className="mt-1 text-4xl font-black text-slate-900">
                      {campaign.currentQuantity}
                    </p>
                  </div>

                  <p className="text-sm font-bold text-slate-500">
                    objectif : {campaign.targetQuantity}
                  </p>
                </div>

                <div className="mt-4 h-4 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-green-600 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <div className="mt-2 flex justify-between text-sm font-bold">
                  <span className="text-green-700">
                    {progress}% atteint
                  </span>

                  <span className="text-slate-500">
                    {Math.max(
                      0,
                      campaign.targetQuantity -
                        campaign.currentQuantity
                    )}{" "}
                    restant(s)
                  </span>
                </div>
              </div>

              {/* Prix actuel */}
              <div className="mt-8 rounded-3xl bg-green-50 p-6">
                <p className="text-sm font-bold text-slate-500">
                  PRIX ACTUEL
                </p>

                <p className="mt-1 text-4xl font-black text-green-700">
                  {currentTier
                    ? currentTier.price.toLocaleString("fr-FR")
                    : "—"}{" "}
                  FCFA
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  par unité
                </p>

                {nextTier && (
                  <div className="mt-5 rounded-2xl bg-white p-4">
                    <p className="text-sm font-bold text-slate-600">
                      🎯 Prochain palier
                    </p>

                    <p className="mt-1 font-black text-slate-900">
                      Encore{" "}
                      {nextTier.minQuantity -
                        campaign.currentQuantity}{" "}
                      unité
                      {nextTier.minQuantity -
                        campaign.currentQuantity >
                      1
                        ? "s"
                        : ""}{" "}
                      pour atteindre{" "}
                      {nextTier.price.toLocaleString("fr-FR")}{" "}
                      FCFA.
                    </p>
                  </div>
                )}
              </div>

              {/* Paliers */}
              <div className="mt-8">
                <h2 className="text-xl font-black text-slate-900">
                  Les paliers de prix
                </h2>

                <div className="mt-4 space-y-3">
                  {campaign.priceTiers.map((tier) => {
                    const active =
                      currentTier?.id === tier.id;

                    return (
                      <div
                        key={tier.id}
                        className={`flex items-center justify-between rounded-2xl border p-4 ${
                          active
                            ? "border-green-600 bg-green-50"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <div>
                          <p className="font-bold text-slate-900">
                            {tier.minQuantity} à{" "}
                            {tier.maxQuantity} unités
                          </p>

                          {active && (
                            <p className="mt-1 text-xs font-bold text-green-700">
                              PALIER ACTUEL
                            </p>
                          )}
                        </div>

                        <p className="text-xl font-black text-green-700">
                          {tier.price.toLocaleString("fr-FR")} FCFA
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* CTA */}
              <Link
                href={`/inscription?campaignId=${campaign.id}`}
                className="mt-8 block rounded-2xl bg-green-700 px-6 py-5 text-center text-lg font-black text-white transition hover:bg-green-800"
              >
                Je veux participer →
              </Link>

              {/* WhatsApp */}
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `🛒 Je participe à cette campagne SamaAchat : ${campaign.product.name}. Achetons ensemble pour payer moins ! https://samaachat.com/campagnes/${campaign.id}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 block rounded-2xl border-2 border-green-700 px-6 py-4 text-center font-black text-green-700 transition hover:bg-green-50"
              >
                Partager sur WhatsApp
              </a>
            </div>
          </div>
        </div>

        {/* Explication */}
        <div className="mt-10 rounded-3xl bg-green-700 p-6 text-white md:p-8">
          <h2 className="text-2xl font-black">
            Comment fonctionne SamaAchat ?
          </h2>

          <div className="mt-6 grid gap-6 md:grid-cols-3">
            <div>
              <p className="text-3xl">👥</p>
              <h3 className="mt-2 font-black">
                1. On se regroupe
              </h3>
              <p className="mt-1 text-sm text-green-50">
                Chaque commande augmente le volume acheté ensemble.
              </p>
            </div>

            <div>
              <p className="text-3xl">📉</p>
              <h3 className="mt-2 font-black">
                2. Le prix baisse
              </h3>
              <p className="mt-1 text-sm text-green-50">
                Lorsque nous atteignons un nouveau palier, le prix
                devient plus intéressant.
              </p>
            </div>

            <div>
              <p className="text-3xl">🛍️</p>
              <h3 className="mt-2 font-black">
                3. On récupère sa commande
              </h3>
              <p className="mt-1 text-sm text-green-50">
                Les modalités de livraison ou de retrait seront
                indiquées pour chaque campagne.
              </p>
            </div>
          </div>
        </div>

        {/* Futurs paniers */}
        <div className="mt-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-black text-slate-900">
            🧺 Les paniers SamaAchat arrivent
          </h2>

          <p className="mt-2 max-w-3xl text-slate-600">
            Demain, SamaAchat pourra aussi regrouper plusieurs
            produits essentiels dans un même panier : riz, huile,
            sucre, oignon, pomme de terre et autres produits du
            quotidien.
          </p>
        </div>
      </section>
    </main>
  );
}