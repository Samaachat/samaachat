"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

type PaymentStatus = "PENDING" | "PAID" | "FAILED";

function ConfirmationContent() {
  const searchParams = useSearchParams();

  const orderId = searchParams.get("orderId");
  const paymentResult = searchParams.get("payment");

  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [paymentStatus, setPaymentStatus] =
    useState<PaymentStatus>("PENDING");
  const [error, setError] = useState("");

  async function checkPayment() {
    if (!orderId) {
      setError("Commande introuvable.");
      return;
    }

    try {
      const response = await fetch(
        `/api/payments/${orderId}`,
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Impossible de vérifier le paiement.");
        return;
      }

      setPaymentStatus(data.paymentStatus ?? "PENDING");
    } catch {
      setError("Impossible de vérifier le paiement.");
    }
  }

  useEffect(() => {
    if (!orderId) return;

    checkPayment();

    // Après le retour de PayTech, on vérifie plusieurs fois
    // car l'IPN peut arriver quelques secondes après.
    if (paymentResult === "success") {
      setChecking(true);

      let attempts = 0;

      const interval = setInterval(async () => {
        attempts += 1;

        await checkPayment();

        if (attempts >= 15) {
          clearInterval(interval);
          setChecking(false);
        }
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [orderId, paymentResult]);

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
          provider: "PAYTECH",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.error ?? "Impossible de démarrer le paiement."
        );
        return;
      }

      if (!data.redirectUrl) {
        setError(
          "PayTech n'a pas fourni de lien de paiement."
        );
        return;
      }

      window.location.href = data.redirectUrl;
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setLoading(false);
    }
  }

  const paid = paymentStatus === "PAID";
  const failed = paymentStatus === "FAILED";

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
            {paid ? "✓" : failed ? "✕" : "!"}
          </div>

          <p className="mt-6 text-sm font-bold text-green-700">
            {paid
              ? "PAIEMENT CONFIRMÉ"
              : failed
              ? "PAIEMENT ANNULÉ"
              : "PAIEMENT EN COURS DE CONFIRMATION"}
          </p>

          <h1 className="mt-2 text-3xl font-black md:text-4xl">
            {paid
              ? "Merci pour votre paiement !"
              : failed
              ? "Le paiement n'a pas abouti."
              : "Merci pour votre commande !"}
          </h1>

          <p className="mx-auto mt-4 max-w-lg leading-7 text-slate-500">
            {paid
              ? "Votre paiement a bien été confirmé. Votre commande est maintenant enregistrée."
              : failed
              ? "Le paiement a été annulé ou n'a pas abouti. Vous pouvez réessayer."
              : "Votre commande est bien enregistrée. Nous vérifions actuellement la confirmation du paiement."}
          </p>

          <div className="mt-8 rounded-2xl bg-green-50 p-5 text-left">
            <div className="flex justify-between">
              <span className="text-slate-500">
                Produit
              </span>

              <span className="font-bold">
                Riz brisé ordinaire
              </span>
            </div>

            <div className="mt-3 flex justify-between">
              <span className="text-slate-500">
                Format
              </span>

              <span className="font-bold">
                Sac de 50 kg
              </span>
            </div>

            <div className="mt-3 flex justify-between">
              <span className="text-slate-500">
                Commande
              </span>

              <span className="font-bold">
                #{orderId ?? "—"}
              </span>
            </div>

            <div className="mt-3 flex justify-between">
              <span className="text-slate-500">
                Statut
              </span>

              <span
                className={
                  paid
                    ? "font-bold text-green-700"
                    : failed
                    ? "font-bold text-red-700"
                    : "font-bold text-yellow-700"
                }
              >
                {paid
                  ? "Payée"
                  : failed
                  ? "Paiement échoué"
                  : "Paiement en cours de confirmation"}
              </span>
            </div>
          </div>

          {!paid && !checking && (
            <div className="mt-6">
              <button
                onClick={handlePayment}
                disabled={loading}
                className="w-full rounded-2xl bg-green-700 px-6 py-4 text-lg font-black text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? "Connexion à PayTech..."
                  : failed
                  ? "Réessayer le paiement"
                  : "Payer maintenant"}
              </button>

              <p className="mt-3 text-xs text-slate-400">
                Paiement sécurisé par PayTech.
              </p>
            </div>
          )}

          {checking && !paid && (
            <div className="mt-6 rounded-2xl border border-yellow-200 bg-yellow-50 p-5">
              <p className="text-sm font-bold text-yellow-800">
                Vérification du paiement...
              </p>

              <p className="mt-2 text-sm leading-6 text-yellow-700">
                Nous attendons la confirmation sécurisée de PayTech.
              </p>
            </div>
          )}

          {paid && (
            <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-5">
              <p className="text-sm font-bold text-green-800">
                Paiement confirmé ✓
              </p>

              <p className="mt-2 text-sm leading-6 text-green-700">
                Vous pouvez consulter votre commande dans votre espace
                commandes.
              </p>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}

          <a
            href="/commandes"
            className="mt-8 block w-full rounded-2xl border border-slate-200 px-6 py-4 text-lg font-black text-slate-700 hover:bg-slate-50"
          >
            Mes commandes
          </a>

          <a
            href="/"
            className="mt-3 block w-full rounded-2xl border border-slate-200 px-6 py-4 text-lg font-black text-slate-700 hover:bg-slate-50"
          >
            Retour à l'accueil
          </a>
        </div>
      </div>
    </main>
  );
}

export default function ConfirmationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50" />
      }
    >
      <ConfirmationContent />
    </Suspense>
  );
}