"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const DEFAULT_PRICE = 13250;

export default function RejoindrePage() {
  const [quantity, setQuantity] = useState(1);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [price, setPrice] = useState(DEFAULT_PRICE);
  const [campaignLoading, setCampaignLoading] = useState(true);
  const [priceTiers, setPriceTiers] = useState<
    { minQuantity: number; maxQuantity: number; price: number }[]
  >([]);

  const router = useRouter();

  useEffect(() => {
    async function loadCampaign() {
      try {
        const response = await fetch("/api/campaign");

        if (!response.ok) {
          throw new Error("Impossible de récupérer la campagne.");
        }

        const data = await response.json();

        setPrice(data.currentPrice);
        setPriceTiers(data.priceTiers);
      } catch (error) {
        console.error(error);
      } finally {
        setCampaignLoading(false);
      }
    }

    loadCampaign();
  }, []);

  const total = price * quantity;

  async function handleSubmit() {
    setError("");

    if (!name.trim() || !phone.trim()) {
      setError(
        "Veuillez renseigner votre nom et votre numéro WhatsApp."
      );
      return;
    }

    if (!address.trim()) {
      setError("Veuillez renseigner votre adresse de livraison.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          phone,
          quantity,
          address,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Une erreur est survenue.");
        return;
      }

      router.push(`/confirmation?orderId=${data.orderId}`);
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-100 bg-white">
        <div className="mx-auto max-w-3xl px-5 py-4">
          <div className="text-2xl font-extrabold text-green-700">
            Sama<span className="text-yellow-500">Achat</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 py-8">
        <a
          href="/"
          className="text-sm font-semibold text-green-700 hover:underline"
        >
          ← Retour aux campagnes
        </a>

        <div className="mt-6 rounded-3xl bg-white p-6 shadow-lg md:p-8">
          <p className="text-sm font-bold text-green-700">
            CAMPAGNE RIZ 50 KG
          </p>

          <h1 className="mt-2 text-3xl font-black">
            Rejoindre le groupe
          </h1>

          <p className="mt-2 text-slate-500">
            Plus nous sommes nombreux, plus le prix baisse.
          </p>

          <div className="mt-8">
            <label className="text-sm font-bold">
              Combien de sacs souhaitez-vous ?
            </label>

            <div className="mt-3 flex items-center justify-between rounded-2xl border border-slate-200 p-3">
              <button
                type="button"
                onClick={() =>
                  setQuantity(Math.max(1, quantity - 1))
                }
                className="h-12 w-12 rounded-xl bg-slate-100 text-2xl font-bold"
              >
                −
              </button>

              <div className="text-center">
                <p className="text-3xl font-black">{quantity}</p>
                <p className="text-xs text-slate-500">
                  sac(s) de 50 kg
                </p>
              </div>

              <button
                type="button"
                onClick={() => setQuantity(quantity + 1)}
                className="h-12 w-12 rounded-xl bg-green-100 text-2xl font-bold text-green-700"
              >
                +
              </button>
            </div>
          </div>

          <div className="mt-8 space-y-5">
            <div>
              <label className="text-sm font-bold">
                Votre nom
              </label>

              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
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
                onChange={(e) => setPhone(e.target.value)}
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
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ex : Parcelles Assainies, Unité 15, près de..."
                rows={3}
                className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-green-600"
              />

              <p className="mt-2 text-xs text-slate-500">
                Indiquez votre quartier, zone et un repère si possible.
              </p>
            </div>
          </div>

          <div className="mt-8">
            <h2 className="text-lg font-black">
              Plus le groupe grandit, plus le prix baisse
            </h2>

            <div className="mt-4 space-y-3">
              {priceTiers.map((tier) => (
                <div
                  key={tier.minQuantity}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 p-4"
                >
                  <div>
                    <p className="font-bold">
                      {tier.minQuantity} à{" "}
                      {tier.maxQuantity >= 999999
                        ? "+"
                        : tier.maxQuantity}{" "}
                      sacs
                    </p>

                    <p className="text-sm text-slate-500">
                      {tier.minQuantity <= quantity &&
                      quantity <= tier.maxQuantity
                        ? "Votre niveau"
                        : ""}
                    </p>
                  </div>

                  <p className="text-lg font-black text-green-700">
                    {tier.price.toLocaleString("fr-FR")} FCFA
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 rounded-2xl bg-green-50 p-5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-600">
                Prix par sac
              </span>

              <span className="font-bold">
                {campaignLoading
                  ? "Chargement..."
                  : `${price.toLocaleString("fr-FR")} FCFA`}
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-green-100 pt-3">
              <span className="text-lg font-black">Total</span>

              <span className="text-2xl font-black text-green-700">
                {total.toLocaleString("fr-FR")} FCFA
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
            disabled={loading}
            className="mt-6 w-full rounded-2xl bg-yellow-400 px-6 py-4 text-lg font-black text-slate-900 hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? "Enregistrement..."
              : "Confirmer ma participation →"}
          </button>

          <p className="mt-4 text-center text-xs text-slate-500">
            Vos informations seront utilisées uniquement pour traiter
            votre commande et organiser la livraison.
          </p>
        </div>
      </div>
    </main>
  );
}
