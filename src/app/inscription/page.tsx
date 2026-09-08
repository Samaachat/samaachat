"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type Campaign = {
  id: number;
  product: {
    name: string;
  };
  currentQuantity: number;
  targetQuantity: number;
  priceTiers: {
    id: number;
    minQuantity: number;
    maxQuantity: number;
    price: number;
  }[];
};

export default function InscriptionPage() {
  const searchParams = useSearchParams();
  const campaignId = searchParams.get("campaignId");

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCampaign() {
      if (!campaignId) {
        setError("Campagne introuvable.");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `/api/campaigns/${campaignId}`,
          {
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error();
        }

        const data = await response.json();
        setCampaign(data.campaign);
      } catch {
        setError("Impossible de charger cette campagne.");
      } finally {
        setLoading(false);
      }
    }

    loadCampaign();
  }, [campaignId]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <p className="font-bold text-slate-600">
          Chargement...
        </p>
      </main>
    );
  }

  if (error || !campaign) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-lg rounded-3xl bg-white p-8 text-center shadow-sm">
          <p className="text-4xl">😕</p>

          <h1 className="mt-4 text-2xl font-black text-slate-900">
            {error || "Campagne introuvable."}
          </h1>

          <Link
            href="/campagnes"
            className="mt-6 block rounded-2xl bg-green-700 px-5 py-4 font-black text-white"
          >
            ← Retour aux campagnes
          </Link>
        </div>
      </main>
    );
  }

  const currentTier =
    campaign.priceTiers
      .filter(
        (tier) =>
          campaign.currentQuantity + quantity >= tier.minQuantity &&
          campaign.currentQuantity + quantity <= tier.maxQuantity
      )
      .at(0) ?? campaign.priceTiers.at(0);

  const unitPrice = currentTier?.price ?? 0;
  const total = unitPrice * quantity;

  const increaseQuantity = () => {
    setQuantity((value) => value + 1);
  };

  const decreaseQuantity = () => {
    setQuantity((value) => Math.max(1, value - 1));
  };

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
            href={`/campagnes/${campaign.id}`}
            className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700"
          >
            ← Campagne
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-2xl px-4 py-10">
        <p className="font-bold text-yellow-600">
          PARTICIPER À L'ACHAT GROUPÉ
        </p>

        <h1 className="mt-2 text-4xl font-black text-slate-900">
          Combien voulez-vous acheter ?
        </h1>

        <p className="mt-3 text-lg text-slate-600">
          {campaign.product.name}
        </p>

        <div className="mt-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-bold text-slate-500">
            QUANTITÉ
          </p>

          <div className="mt-5 flex items-center justify-center gap-6">
            <button
              type="button"
              onClick={decreaseQuantity}
              disabled={quantity <= 1}
              className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-3xl font-black text-slate-700 disabled:opacity-40"
            >
              −
            </button>

            <div className="min-w-20 text-center">
              <p className="text-5xl font-black text-slate-900">
                {quantity}
              </p>

              <p className="mt-1 text-sm font-bold text-slate-500">
                unité{quantity > 1 ? "s" : ""}
              </p>
            </div>

            <button
              type="button"
              onClick={increaseQuantity}
              className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100 text-3xl font-black text-green-700"
            >
              +
            </button>
          </div>

          <div className="mt-8 rounded-3xl bg-green-50 p-6">
            <p className="text-sm font-bold text-slate-500">
              VOTRE PRIX ACTUEL
            </p>

            <p className="mt-1 text-3xl font-black text-green-700">
              {unitPrice.toLocaleString("fr-FR")} FCFA
            </p>

            <p className="mt-1 text-sm text-slate-500">
              par unité
            </p>

            <div className="mt-5 border-t border-green-100 pt-5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-600">
                  Quantité
                </span>

                <span className="font-black text-slate-900">
                  {quantity}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span className="font-bold text-slate-600">
                  Total
                </span>

                <span className="text-2xl font-black text-slate-900">
                  {total.toLocaleString("fr-FR")} FCFA
                </span>
              </div>
            </div>
          </div>

          {currentTier && (
            <p className="mt-5 text-sm font-bold text-slate-600">
              Palier appliqué : {currentTier.minQuantity} à{" "}
              {currentTier.maxQuantity} unités.
            </p>
          )}

          <div className="mt-8 rounded-2xl bg-yellow-50 p-4">
            <p className="font-bold text-slate-800">
              💡 Le prix dépend du volume du groupe.
            </p>

            <p className="mt-1 text-sm text-slate-600">
              Plus le groupe atteint de gros volumes, plus le prix
              peut baisser.
            </p>
          </div>

          <button
            type="button"
            className="mt-8 w-full rounded-2xl bg-green-700 px-6 py-5 text-lg font-black text-white transition hover:bg-green-800"
            onClick={() => {
              const params = new URLSearchParams({
                campaignId: String(campaign.id),
                quantity: String(quantity),
              });

              window.location.href = `/rejoindre?${params.toString()}`;
            }}
          >
            Continuer →
          </button>
        </div>
      </section>
    </main>
  );
}