"use client";

import { useState } from "react";

type Order = {
  id: number;
  product: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  finalUnitPrice: number | null;
  finalAmount: number | null;
  status: string;
  paymentStatus: string;
  createdAt: string;
};

function getStatusLabel(status: string) {
  switch (status) {
    case "PENDING":
      return "En attente";
    case "CONFIRMED":
      return "Confirmée";
    case "DELIVERED":
      return "Livrée";
    case "CANCELLED":
      return "Annulée";
    default:
      return status;
  }
}

export default function CommandesPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");

  async function searchOrders() {
    const cleanPhone = phone.replace(/\s/g, "").trim();

    if (!cleanPhone) {
      setError("Veuillez saisir votre numéro de téléphone.");
      return;
    }

    setLoading(true);
    setSearched(true);
    setError("");
    setOrders([]);

    try {
      const response = await fetch(
        `/api/orders/${encodeURIComponent(cleanPhone)}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Impossible de récupérer vos commandes.");
        return;
      }

      setOrders(data.orders ?? []);
    } catch {
      setError(
        "Impossible de contacter le serveur. Vérifiez que SamaAchat est bien lancé."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>
  ) {
    if (event.key === "Enter") {
      searchOrders();
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-100 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <a
            href="/"
            className="text-2xl font-extrabold text-green-700"
          >
            Sama<span className="text-yellow-500">Achat</span>
          </a>

          <a
            href="/rejoindre"
            className="rounded-xl bg-green-700 px-4 py-2 text-sm font-bold text-white"
          >
            Nouvelle commande
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-5 py-10">
        <h1 className="text-3xl font-black text-slate-900">
          Mes commandes
        </h1>

        <p className="mt-2 text-slate-500">
          Entrez votre numéro de téléphone pour retrouver vos commandes.
        </p>

        <div className="mt-6 rounded-3xl bg-white p-5 shadow-sm">
          <label className="text-sm font-bold text-slate-700">
            Numéro de téléphone
          </label>

          <div className="mt-2 flex gap-2">
            <input
              type="tel"
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value);
                setError("");
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ex. 771234567"
              className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-green-600"
            />

            <button
              type="button"
              onClick={searchOrders}
              disabled={!phone.trim() || loading}
              className="rounded-xl bg-green-700 px-5 py-3 font-bold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Recherche..." : "Rechercher"}
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          )}
        </div>

        {loading && (
          <div className="mt-8 rounded-3xl bg-white p-8 text-center shadow-sm">
            <p className="font-bold text-slate-700">
              Recherche de vos commandes...
            </p>
          </div>
        )}

        {!loading && searched && !error && orders.length === 0 && (
          <div className="mt-8 rounded-3xl bg-white p-8 text-center shadow-sm">
            <p className="text-lg font-bold text-slate-800">
              Aucune commande trouvée
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Vérifiez votre numéro de téléphone.
            </p>
          </div>
        )}

        {!loading && orders.length > 0 && (
          <div className="mt-8 space-y-5">
            {orders.map((order) => (
              <div
                key={order.id}
                className="rounded-3xl bg-white p-6 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-green-700">
                      Commande #{order.id}
                    </p>

                    <h2 className="mt-1 text-xl font-black text-slate-900">
                      {order.product}
                    </h2>
                  </div>

                  <span
                    className={
                      order.paymentStatus === "PAID"
                        ? "rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700"
                        : "rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-700"
                    }
                  >
                    {order.paymentStatus === "PAID"
                      ? "Payée"
                      : "Paiement en attente"}
                  </span>
                </div>

                <div className="mt-6 rounded-2xl border border-slate-100 p-4">
                  <p className="text-sm font-bold text-slate-700">
                    Suivi de la commande
                  </p>

                  <div className="mt-4 flex items-center">
                    <div className="flex flex-1 flex-col items-center">
                      <div
                        className={
                          order.status !== "CANCELLED"
                            ? "flex h-9 w-9 items-center justify-center rounded-full bg-green-700 text-sm font-black text-white"
                            : "flex h-9 w-9 items-center justify-center rounded-full bg-red-600 text-sm font-black text-white"
                        }
                      >
                        {order.status === "CANCELLED" ? "×" : "1"}
                      </div>

                      <span className="mt-2 text-center text-xs font-bold text-slate-600">
                        Commandée
                      </span>
                    </div>

                    <div
                      className={
                        order.status === "CONFIRMED" ||
                        order.status === "DELIVERED"
                          ? "h-1 flex-1 bg-green-600"
                          : "h-1 flex-1 bg-slate-200"
                      }
                    />

                    <div className="flex flex-1 flex-col items-center">
                      <div
                        className={
                          order.status === "CONFIRMED" ||
                          order.status === "DELIVERED"
                            ? "flex h-9 w-9 items-center justify-center rounded-full bg-green-700 text-sm font-black text-white"
                            : "flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-sm font-black text-slate-500"
                        }
                      >
                        2
                      </div>

                      <span className="mt-2 text-center text-xs font-bold text-slate-600">
                        Confirmée
                      </span>
                    </div>

                    <div
                      className={
                        order.status === "DELIVERED"
                          ? "h-1 flex-1 bg-green-600"
                          : "h-1 flex-1 bg-slate-200"
                      }
                    />

                    <div className="flex flex-1 flex-col items-center">
                      <div
                        className={
                          order.status === "DELIVERED"
                            ? "flex h-9 w-9 items-center justify-center rounded-full bg-green-700 text-sm font-black text-white"
                            : "flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-sm font-black text-slate-500"
                        }
                      >
                        3
                      </div>

                      <span className="mt-2 text-center text-xs font-bold text-slate-600">
                        Livrée
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 text-center">
                    <span
                      className={
                        order.status === "DELIVERED"
                          ? "font-black text-green-700"
                          : order.status === "CONFIRMED"
                            ? "font-black text-green-700"
                            : order.status === "CANCELLED"
                              ? "font-black text-red-600"
                              : "font-black text-yellow-600"
                      }
                    >
                      {getStatusLabel(order.status)}
                    </span>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-400">Quantité</p>
                    <p className="mt-1 font-bold">
                      {order.quantity} sac
                      {order.quantity > 1 ? "s" : ""}
                    </p>
                  </div>

                  <div>
                    <p className="text-slate-400">Prix unitaire</p>
                    <p className="mt-1 font-bold">
                      {order.unitPrice.toLocaleString("fr-FR")} FCFA
                    </p>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl bg-green-50 p-4">
                  <div className="flex justify-between">
                    <span className="text-slate-500">
                      Montant
                    </span>

                    <span className="text-lg font-black text-green-700">
                      {order.amount.toLocaleString("fr-FR")} FCFA
                    </span>
                  </div>

                  {order.finalUnitPrice !== null && (
                    <div className="mt-3 border-t border-green-100 pt-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">
                          Prix final du groupe
                        </span>

                        <span className="font-bold">
                          {order.finalUnitPrice.toLocaleString(
                            "fr-FR"
                          )}{" "}
                          FCFA
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 text-xs text-slate-400">
                  Commande créée le{" "}
                  {new Date(order.createdAt).toLocaleDateString(
                    "fr-FR"
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}