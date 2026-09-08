"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Campaign = {
  id: number;
  currentQuantity: number;
  targetQuantity: number;
  product: {
    name: string;
    description: string | null;
  };
  priceTiers: {
    id: number;
    minQuantity: number;
    maxQuantity: number;
    price: number;
  }[];
};

export default function Home() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCampaigns() {
      try {
        const response = await fetch("/api/campaigns");

        if (!response.ok) {
          throw new Error("Impossible de charger les campagnes.");
        }

        const data = await response.json();
        setCampaigns(data.campaigns ?? []);
      } catch (error) {
        console.error("Erreur chargement campagnes :", error);
      } finally {
        setLoading(false);
      }
    }

    loadCampaigns();
  }, []);

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-2xl font-bold text-green-900">
              SamaAchat
            </h1>

            <p className="text-sm text-gray-500">
              Achetez ensemble. Payez moins.
            </p>
          </div>

          <Link
            href="/commandes"
            className="rounded-full bg-green-800 px-5 py-2.5 font-semibold text-white"
          >
            Mes commandes
          </Link>
        </div>
      </header>

      <section className="bg-green-50 px-6 py-14">
        <div className="mx-auto max-w-6xl">
          <span className="rounded-full bg-yellow-300 px-4 py-2 text-sm font-semibold text-green-950">
            Achat groupé à Dakar
          </span>

          <h2 className="mt-6 text-4xl font-extrabold tracking-tight text-green-950 md:text-6xl">
            Achetez ensemble.
            <br />
            Payez moins.
          </h2>

          <p className="mt-6 max-w-3xl text-lg text-gray-700">
            Plus nous sommes nombreux, plus le prix baisse.
            Rejoignez un groupe et économisez sur vos achats essentiels.
          </p>
        </div>
      </section>

      <section className="px-6 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-wide text-green-700">
              Nos campagnes
            </p>

            <h2 className="mt-2 text-3xl font-bold text-green-950">
              Produits disponibles
            </h2>
          </div>

          {loading ? (
            <div className="rounded-3xl border bg-white p-8 text-center shadow-sm">
              <p className="font-bold text-gray-700">
                Chargement des campagnes...
              </p>
            </div>
          ) : campaigns.length === 0 ? (
            <div className="rounded-3xl border bg-white p-8 text-center shadow-sm">
              <p className="font-bold text-gray-700">
                Aucune campagne active pour le moment.
              </p>

              <p className="mt-2 text-gray-500">
                Revenez bientôt pour découvrir nos prochaines offres.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {campaigns.map((campaign) => {
                const currentQuantity = campaign.currentQuantity;
                const targetQuantity = campaign.targetQuantity;

                const progress = Math.min(
                  Math.round(
                    (currentQuantity / targetQuantity) * 100
                  ),
                  100
                );

                const currentTier =
                  campaign.priceTiers.find(
                    (tier) =>
                      currentQuantity >= tier.minQuantity &&
                      currentQuantity <= tier.maxQuantity
                  ) ?? campaign.priceTiers[0];

                const nextTier = campaign.priceTiers.find(
                  (tier) => tier.minQuantity > currentQuantity
                );

                return (
                  <article
                    key={campaign.id}
                    className="overflow-hidden rounded-3xl border bg-white shadow-sm"
                  >
                    <div className="p-6 md:p-8">
                      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                        <div>
                          <p className="text-sm font-semibold uppercase tracking-wide text-green-700">
                            Campagne en cours
                          </p>

                          <h3 className="mt-2 text-2xl font-bold text-green-950">
                            {campaign.product.name}
                          </h3>

                          <p className="mt-2 text-gray-600">
                            {campaign.product.description}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-yellow-100 px-5 py-4 text-center">
                          <p className="text-sm text-gray-600">
                            Prix actuel
                          </p>

                          <p className="text-2xl font-extrabold text-green-950">
                            {currentTier
                              ? currentTier.price.toLocaleString("fr-FR")
                              : "—"}{" "}
                            FCFA
                          </p>
                        </div>
                      </div>

                      <div className="mt-8">
                        <div className="mb-3 flex justify-between text-sm font-semibold">
                          <span>
                            {currentQuantity} / {targetQuantity} unités
                          </span>

                          <span>{progress}%</span>
                        </div>

                        <div className="h-4 overflow-hidden rounded-full bg-gray-200">
                          <div
                            className="h-full rounded-full bg-green-700 transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>

                      {nextTier && (
                        <div className="mt-5 rounded-2xl bg-green-50 p-4">
                          <p className="font-semibold text-green-900">
                            Encore{" "}
                            {Math.max(
                              nextTier.minQuantity - currentQuantity,
                              0
                            )}{" "}
                            unités pour atteindre{" "}
                            {nextTier.price.toLocaleString("fr-FR")} FCFA.
                          </p>
                        </div>
                      )}

                      <div className="mt-8">
                        <Link
                          href="/rejoindre"
                          className="block rounded-2xl bg-green-800 px-6 py-4 text-center font-bold text-white hover:bg-green-900"
                        >
                          Rejoindre le groupe
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="bg-gray-50 px-6 py-14">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold text-green-950">
            Comment ça marche ?
          </h2>

          <div className="mt-8 grid gap-5 md:grid-cols-3">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="text-3xl">1️⃣</div>

              <h3 className="mt-4 font-bold">Choisissez</h3>

              <p className="mt-2 text-gray-600">
                Choisissez le produit dont vous avez besoin.
              </p>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="text-3xl">2️⃣</div>

              <h3 className="mt-4 font-bold">
                Rejoignez le groupe
              </h3>

              <p className="mt-2 text-gray-600">
                Plus de participants permettent d'obtenir un meilleur prix.
              </p>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="text-3xl">3️⃣</div>

              <h3 className="mt-4 font-bold">Économisez</h3>

              <p className="mt-2 text-gray-600">
                Le prix final dépend du volume atteint.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t px-6 py-8 text-center text-sm text-gray-500">
        © 2026 SamaAchat — Achetez ensemble. Payez moins.
      </footer>
    </main>
  );
}