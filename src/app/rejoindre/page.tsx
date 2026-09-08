"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Campaign = {
  id: number;
  product: {
    name: string;
    description: string | null;
    unit: string;
  };
  currentQuantity: number;
  targetQuantity: number;
  priceTiers: {
    minQuantity: number;
    maxQuantity: number;
    price: number;
  }[];
};

type SelectedProduct = {
  campaignId: number;
  quantity: number;
  price: number;
};

export default function RejoindrePage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selected, setSelected] = useState<SelectedProduct[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [campaignLoading, setCampaignLoading] = useState(true);
  const [error, setError] = useState("");

  const router = useRouter();

  function getPrice(campaign: Campaign, quantity: number) {
    const projectedQuantity =
      campaign.currentQuantity + quantity;

    const tier = campaign.priceTiers.find(
      (tier) =>
        projectedQuantity >= tier.minQuantity &&
        projectedQuantity <= tier.maxQuantity
    );

    return (
      tier?.price ??
      campaign.priceTiers[0]?.price ??
      0
    );
  }

  useEffect(() => {
    async function loadCampaigns() {
      try {
        const response = await fetch("/api/campaigns", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(
            "Impossible de récupérer les campagnes."
          );
        }

        const data = await response.json();

        const loadedCampaigns: Campaign[] =
          data.campaigns ?? [];

        setCampaigns(loadedCampaigns);

        /*
         * Si le client arrive depuis :
         *
         * /inscription?campaignId=1&quantity=2
         *
         * on récupère automatiquement la campagne
         * et la quantité choisie.
         */
        const params = new URLSearchParams(
          window.location.search
        );

        const campaignId = Number(
          params.get("campaignId")
        );

        const quantity = Number(
          params.get("quantity")
        );

        if (
          Number.isInteger(campaignId) &&
          campaignId > 0 &&
          Number.isInteger(quantity) &&
          quantity > 0
        ) {
          const campaign = loadedCampaigns.find(
            (item) => item.id === campaignId
          );

          if (campaign) {
            const price = getPrice(
              campaign,
              quantity
            );

            setSelected([
              {
                campaignId: campaign.id,
                quantity,
                price,
              },
            ]);
          }
        }
      } catch (error) {
        console.error(error);
        setError(
          "Impossible de charger les produits."
        );
      } finally {
        setCampaignLoading(false);
      }
    }

    loadCampaigns();
  }, []);

  function getQuantity(campaignId: number) {
    return (
      selected.find(
        (item) => item.campaignId === campaignId
      )?.quantity ?? 0
    );
  }

  function updateQuantity(
    campaign: Campaign,
    quantity: number
  ) {
    const safeQuantity = Math.max(0, quantity);

    if (safeQuantity === 0) {
      setSelected((current) =>
        current.filter(
          (item) => item.campaignId !== campaign.id
        )
      );

      return;
    }

    const price = getPrice(
      campaign,
      safeQuantity
    );

    setSelected((current) => {
      const existing = current.find(
        (item) =>
          item.campaignId === campaign.id
      );

      if (existing) {
        return current.map((item) =>
          item.campaignId === campaign.id
            ? {
                ...item,
                quantity: safeQuantity,
                price,
              }
            : item
        );
      }

      return [
        ...current,
        {
          campaignId: campaign.id,
          quantity: safeQuantity,
          price,
        },
      ];
    });
  }

  const total = selected.reduce(
    (sum, item) =>
      sum + item.quantity * item.price,
    0
  );

  const totalItems = selected.reduce(
    (sum, item) =>
      sum + item.quantity,
    0
  );

  async function handleSubmit() {
    setError("");

    if (selected.length === 0) {
      setError(
        "Veuillez choisir au moins un produit."
      );
      return;
    }

    if (!name.trim() || !phone.trim()) {
      setError(
        "Veuillez renseigner votre nom et votre numéro WhatsApp."
      );
      return;
    }

    if (!address.trim()) {
      setError(
        "Veuillez renseigner votre adresse de livraison."
      );
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "/api/orders",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            phone,
            address,
            items: selected,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.error ||
            "Une erreur est survenue."
        );
        return;
      }

      router.push(
        `/confirmation?orderId=${data.orderId}`
      );
    } catch {
      setError(
        "Impossible de contacter le serveur."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-100 bg-white">
        <div className="mx-auto max-w-4xl px-5 py-4">
          <div className="text-2xl font-extrabold text-green-700">
            Sama
            <span className="text-yellow-500">
              Achat
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-5 py-8">
        <a
          href="/campagnes"
          className="text-sm font-semibold text-green-700 hover:underline"
        >
          ← Retour aux campagnes
        </a>

        <div className="mt-6">
          <h1 className="text-3xl font-black">
            Faites vos achats ensemble
          </h1>

          <p className="mt-2 text-slate-500">
            Choisissez les produits que vous
            souhaitez acheter.
          </p>
        </div>

        {campaignLoading ? (
          <div className="mt-8 rounded-3xl bg-white p-8 text-center shadow-lg">
            Chargement des produits...
          </div>
        ) : (
          <div className="mt-8 space-y-5">
            {campaigns.map((campaign) => {
              const quantity =
                getQuantity(campaign.id);

              const price = getPrice(
                campaign,
                quantity || 1
              );

              const productTotal =
                quantity * price;

              return (
                <div
                  key={campaign.id}
                  className={`rounded-3xl bg-white p-6 shadow-lg ${
                    quantity > 0
                      ? "ring-2 ring-green-500"
                      : ""
                  }`}
                >
                  <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-bold text-green-700">
                        ACHAT GROUPÉ
                      </p>

                      <h2 className="mt-1 text-2xl font-black">
                        {campaign.product.name}
                      </h2>

                      <p className="mt-1 text-sm text-slate-500">
                        {campaign.product.description ??
                          campaign.product.unit}
                      </p>

                      <p className="mt-3 font-bold text-green-700">
                        {price.toLocaleString(
                          "fr-FR"
                        )}{" "}
                        FCFA /{" "}
                        {campaign.product.unit.toLowerCase()}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {campaign.currentQuantity} /{" "}
                        {campaign.targetQuantity}{" "}
                        déjà commandés
                      </p>
                    </div>

                    <div className="flex items-center justify-between rounded-2xl border border-slate-200 p-3 md:w-64">
                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity(
                            campaign,
                            quantity - 1
                          )
                        }
                        className="h-12 w-12 rounded-xl bg-slate-100 text-2xl font-bold"
                      >
                        −
                      </button>

                      <div className="text-center">
                        <p className="text-3xl font-black">
                          {quantity}
                        </p>

                        <p className="text-xs text-slate-500">
                          {campaign.product.unit}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity(
                            campaign,
                            quantity + 1
                          )
                        }
                        className="h-12 w-12 rounded-xl bg-green-100 text-2xl font-bold text-green-700"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {quantity > 0 && (
                    <div className="mt-5 border-t border-slate-100 pt-4 text-right">
                      <span className="text-sm text-slate-500">
                        Sous-total :{" "}
                      </span>

                      <span className="text-lg font-black text-green-700">
                        {productTotal.toLocaleString(
                          "fr-FR"
                        )}{" "}
                        FCFA
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 rounded-3xl bg-white p-6 shadow-lg md:p-8">
          <h2 className="text-xl font-black">
            Vos informations
          </h2>

          <div className="mt-5 space-y-5">
            <div>
              <label className="text-sm font-bold">
                Votre nom
              </label>

              <input
                type="text"
                value={name}
                onChange={(e) =>
                  setName(e.target.value)
                }
                placeholder="Ex : Mamadou Ndiaye"
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-green-600"
              />
            </div>

            <div>
              <label className="text-sm font-bold">
                Numéro WhatsApp
              </label>

              <input
                type="tel"
                value={phone}
                onChange={(e) =>
                  setPhone(e.target.value)
                }
                placeholder="Ex : 77 123 45 67"
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-green-600"
              />
            </div>

            <div>
              <label className="text-sm font-bold">
                Adresse de livraison
              </label>

              <textarea
                value={address}
                onChange={(e) =>
                  setAddress(e.target.value)
                }
                placeholder="Ex : Parcelles Assainies, Unité 15, près de..."
                rows={3}
                className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-green-600"
              />

              <p className="mt-2 text-xs text-slate-500">
                Indiquez votre quartier, zone et
                un repère si possible.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-3xl bg-green-50 p-6">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-600">
              Produits sélectionnés
            </span>

            <span className="font-bold">
              {totalItems}
            </span>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-green-100 pt-3">
            <span className="text-lg font-black">
              Total
            </span>

            <span className="text-2xl font-black text-green-700">
              {total.toLocaleString("fr-FR")}{" "}
              FCFA
            </span>
          </div>
        </div>

        {error && (
          <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={
            loading || campaignLoading
          }
          className="mt-6 w-full rounded-2xl bg-yellow-400 px-6 py-4 text-lg font-black text-slate-900 hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading
            ? "Enregistrement..."
            : "Confirmer ma commande →"}
        </button>

        <p className="mt-4 text-center text-xs text-slate-500">
          Vos informations seront utilisées
          uniquement pour traiter votre commande
          et organiser la livraison.
        </p>
      </div>
    </main>
  );
}