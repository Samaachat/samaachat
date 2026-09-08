
"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

export default function ConfirmationPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");

  const [loading, setLoading] = useState(false);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState("");

  async function handlePayment() {
    if (!orderId) {
      setError("Commande introuvable.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId: Number(orderId),
          provider: "TEST",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Le paiement a échoué.");
        return;
      }

      setPaid(true);
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

      <div className="mx-auto max-w-2xl px-5 py-12">
        <div className="rounded-3xl bg-white p-8 text-center shadow-lg md:p-12">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-4xl">
            {paid ? "✓" : "!"}
          </div>

          <p className="mt-6 text-sm font-bold text-green-700">
            {paid ? "PAIEMENT CONFIRMÉ" : "PARTICIPATION ENREGISTRÉE"}
          </p>

          <h1 className="mt-2 text-3xl font-black md:text-4xl">
            {paid ? "Merci pour votre paiement !" : "Merci pour votre commande !"}
          </h1>

          <p className="mx-auto mt-4 max-w-lg leading-7 text-slate-500">
            {paid
              ? "Votre paiement a bien été enregistré. Votre commande est maintenant confirmée."
              : "Votre participation à la campagne de riz a bien été prise en compte."}
          </p>

          <div className="mt-8 rounded-2xl bg-green-50 p-5 text-left">
            <div className="flex justify-between">
              <span className="text-slate-500">Produit</span>
              <span className="font-bold">Riz brisé ordinaire</span>
            </div>

            <div className="mt-3 flex justify-between">
              <span className="text-slate-500">Format</span>
              <span className="font-bold">Sac de 50 kg</span>
            </div>

            <div className="mt-3 flex justify-between">
              <span className="text-slate-500">Commande</span>
              <span className="font-bold">#{orderId ?? "—"}</span>
            </div>

            <div className="mt-3 flex justify-between">
              <span className="text-slate-500">Statut</span>
              <span
                className={
                  paid
                    ? "font-bold text-green-700"
                    : "font-bold text-yellow-700"
                }
              >
                {paid ? "Paiement confirmé" : "En attente de paiement"}
              </span>
            </div>
          </div>

          {!paid && (
            <div className="mt-6">
              <button
                onClick={handlePayment}
                disabled={loading}
                className="w-full rounded-2xl bg-green-700 px-6 py-4 text-lg font-black text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Paiement en cours..." : "Payer maintenant"}
              </button>

              <p className="mt-3 text-xs text-slate-400">
                Mode de paiement de test — aucun argent réel n'est débité.
              </p>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}

          {paid && (
            <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-5">
              <p className="text-sm font-bold text-green-800">
                Votre commande est confirmée.
              </p>
              <p className="mt-2 text-sm leading-6 text-green-700">
                Nous pourrons ensuite ajouter les informations de livraison
                et les vrais moyens de paiement.
              </p>
            </div>
          )}

          <a
            href="/"
            className="mt-8 block w-full rounded-2xl border border-slate-200 px-6 py-4 text-lg font-black text-slate-700 hover:bg-slate-50"
          >
            Retour à l'accueil
          </a>
        </div>
      </div>
    </main>
  );
}
