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

type CartItem = {
  campaignId: number;
  quantity: number;
};

export default function Home() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [cartCount, setCartCount] = useState(0);
  const [addedProduct, setAddedProduct] = useState("");

  function getCampaignImage(productName: string) {
    const name = productName.toLowerCase();

    if (name.includes("riz")) {
      return "/images/campagnes/riz-50kg.png";
    }

    if (name.includes("huile")) {
      return "/images/campagnes/huile-5l.png";
    }

    if (name.includes("oignon")) {
      return "/images/campagnes/oignon-25kg.png";
    }

    if (name.includes("sucre")) {
      return "/images/campagnes/sucre-50kg.png";
    }

    if (
      name.includes("pomme") ||
      name.includes("terre")
    ) {
      return "/images/campagnes/pomme-de-terre-25kg.png";
    }

    return null;
  }

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

  useEffect(() => {
    try {
      const savedCart = localStorage.getItem("samaachat-cart");

      if (savedCart) {
        const cart: CartItem[] = JSON.parse(savedCart);

        const count = cart.reduce(
          (sum, item) => sum + item.quantity,
          0
        );

        setCartCount(count);
      }
    } catch (error) {
      console.error("Erreur chargement panier :", error);
    }
  }, []);

  function addToCart(campaign: Campaign) {
    try {
      const savedCart = localStorage.getItem("samaachat-cart");

      let cart: CartItem[] = savedCart
        ? JSON.parse(savedCart)
        : [];

      const existingItem = cart.find(
        (item) => item.campaignId === campaign.id
      );

      if (existingItem) {
        cart = cart.map((item) =>
          item.campaignId === campaign.id
            ? {
                ...item,
                quantity: item.quantity + 1,
              }
            : item
        );
      } else {
        cart.push({
          campaignId: campaign.id,
          quantity: 1,
        });
      }

      localStorage.setItem(
        "samaachat-cart",
        JSON.stringify(cart)
      );

      const count = cart.reduce(
        (sum, item) => sum + item.quantity,
        0
      );

      setCartCount(count);
      setAddedProduct(campaign.product.name);

      setTimeout(() => {
        setAddedProduct("");
      }, 2000);
    } catch (error) {
      console.error("Erreur ajout panier :", error);
    }
  }

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5">
          <div>
            <h1 className="text-2xl font-bold text-green-900">
              SamaAchat
            </h1>

            <p className="text-sm text-gray-500">
              Achetez ensemble. Payez moins.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/rejoindre"
              className="relative rounded-full border border-green-800 px-5 py-2.5 font-semibold text-green-800 hover:bg-green-50"
            >
              🛒 Panier

              {cartCount > 0 && (
                <span className="ml-2 rounded-full bg-yellow-400 px-2 py-0.5 text-xs font-black text-green-950">
                  {cartCount}
                </span>
              )}
            </Link>

            <Link
              href="/commandes"
              className="hidden rounded-full bg-green-800 px-5 py-2.5 font-semibold text-white sm:block"
            >
              Mes commandes
            </Link>
          </div>
        </div>
      </header>

      {addedProduct && (
        <div className="fixed left-1/2 top-5 z-50 -translate-x-1/2 rounded-2xl bg-green-800 px-5 py-3 text-sm font-bold text-white shadow-xl">
          ✓ {addedProduct} ajouté au panier
        </div>
      )}

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

          <div className="mt-8">
            <Link
              href="/rejoindre"
              className="inline-block rounded-2xl bg-yellow-400 px-6 py-4 font-black text-slate-900 hover:bg-yellow-300"
            >
              🛒 Voir mon panier
            </Link>
          </div>
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

            <p className="mt-2 text-gray-600">
              Ajoutez plusieurs produits à votre panier avant de passer commande.
            </p>
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
                const currentQuantity =
                  campaign.currentQuantity;

                const targetQuantity =
                  campaign.targetQuantity;

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

                const nextTier =
                  campaign.priceTiers.find(
                    (tier) =>
                      tier.minQuantity > currentQuantity
                  );

                const campaignImage = getCampaignImage(
                  campaign.product.name
                );

                return (
                  <article
                    key={campaign.id}
                    className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                  >
                    {campaignImage && (
                      <div className="flex h-64 items-center justify-center bg-slate-50 p-5 sm:h-72">
                        <img
                          src={campaignImage}
                          alt={campaign.product.name}
                          className="h-full w-full object-contain object-center"
                        />
                      </div>
                    )}

                    <div className="p-6 md:p-8">
                      <div className="flex flex-col gap-5">
                        <div className="text-center">
                          <p className="inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-black uppercase tracking-wide text-green-800">
                            Campagne en cours
                          </p>

                          <h3 className="mt-3 text-2xl font-black text-green-950 md:text-3xl">
                            {campaign.product.name}
                          </h3>

                          <p className="mx-auto mt-2 max-w-xl text-gray-600">
                            {campaign.product.description}
                          </p>
                        </div>

                        <div className="mx-auto w-full max-w-xs rounded-2xl bg-yellow-100 px-5 py-4 text-center">
                          <p className="text-sm font-semibold text-gray-600">
                            Prix actuel
                          </p>

                          <p className="text-2xl font-extrabold text-green-950">
                            {currentTier
                              ? currentTier.price.toLocaleString(
                                  "fr-FR"
                                )
                              : "—"}{" "}
                            FCFA
                          </p>
                        </div>
                      </div>

                      <div className="mt-8">
                        <div className="mb-3 flex justify-between text-sm font-semibold">
                          <span>
                            {currentQuantity} /{" "}
                            {targetQuantity} unités
                          </span>

                          <span>{progress}%</span>
                        </div>

                        <div className="h-4 overflow-hidden rounded-full bg-gray-200">
                          <div
                            className="h-full rounded-full bg-green-700 transition-all"
                            style={{
                              width: `${progress}%`,
                            }}
                          />
                        </div>
                      </div>

                      {nextTier && (
                        <div className="mt-5 rounded-2xl bg-green-50 p-4">
                          <p className="font-semibold text-green-900">
                            Encore{" "}
                            {Math.max(
                              nextTier.minQuantity -
                                currentQuantity,
                              0
                            )}{" "}
                            unités pour atteindre{" "}
                            {nextTier.price.toLocaleString(
                              "fr-FR"
                            )}{" "}
                            FCFA.
                          </p>
                        </div>
                      )}

                      <div className="mt-8">
                        <button
                          type="button"
                          onClick={() =>
                            addToCart(campaign)
                          }
                          className="w-full rounded-2xl bg-green-800 px-6 py-4 text-center font-bold text-white hover:bg-green-900"
                        >
                          🛒 Ajouter au panier
                        </button>
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

              <h3 className="mt-4 font-bold">
                Ajoutez au panier
              </h3>

              <p className="mt-2 text-gray-600">
                Choisissez un ou plusieurs produits sans quitter la page.
              </p>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="text-3xl">2️⃣</div>

              <h3 className="mt-4 font-bold">
                Passez votre commande
              </h3>

              <p className="mt-2 text-gray-600">
                Vérifiez votre panier puis renseignez vos informations.
              </p>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="text-3xl">3️⃣</div>

              <h3 className="mt-4 font-bold">
                Économisez
              </h3>

              <p className="mt-2 text-gray-600">
                Plus nous achetons ensemble, plus le prix peut baisser.
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