"use client";

import { useEffect, useState } from "react";

type PriceTier = {
  minQuantity: number;
  maxQuantity: number;
  price: number;
};

type Campaign = {
  id: number;
  product: string;
  unit?: string;
  currentQuantity: number;
  targetQuantity: number;
  priceTiers: PriceTier[];
};

type Order = {
  id: number;
  customer: string;
  phone: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  orderStatus: string;
  paymentStatus: string;

  items: {
    campaignId: number;
    product: string;
    unit?: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }[];

  address: string;
  deliveryStatus: string;
  deliveryDate: string | null;
  createdAt: string;
};

type Statistics = {
  customers: number;
  orders: number;
  paidOrders: number;
  totalQuantity: number;
  totalRevenue: number;
};

type DashboardData = {
  campaigns: Campaign[];
  campaign: Campaign | null;
  statistics: Statistics;
  orders: Order[];
};

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [closeMessage, setCloseMessage] = useState("");
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(
    null
  );
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);

  const [orderFilter, setOrderFilter] = useState("ALL");
  const [orderSearch, setOrderSearch] = useState("");

  async function loadDashboard() {
    try {
      const authResponse = await fetch("/api/admin/me");

      if (!authResponse.ok) {
        window.location.href = "/admin/login";
        return;
      }

      const response = await fetch("/api/admin/dashboard", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Impossible de récupérer les données.");
      }

      const dashboardData = await response.json();

      setData(dashboardData);

      if (
        selectedCampaignId === null &&
        dashboardData.campaigns?.length > 0
      ) {
        setSelectedCampaignId(dashboardData.campaigns[0].id);
      }
    } catch (error) {
      console.error("Erreur dashboard :", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  async function closeCampaign() {
    if (selectedCampaignId === null) {
      setCloseMessage("Veuillez sélectionner une campagne.");
      return;
    }

    const selectedCampaign =
      data?.campaigns.find(
        (campaign) => campaign.id === selectedCampaignId
      ) ?? null;

    const confirmed = window.confirm(
      `Êtes-vous sûr de vouloir clôturer la campagne "${selectedCampaign?.product ?? ""}" ? Le prix final sera appliqué aux commandes concernées.`
    );

    if (!confirmed) {
      return;
    }

    setClosing(true);
    setCloseMessage("");

    try {
      const response = await fetch("/api/admin/campaign/close", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          campaignId: selectedCampaignId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setCloseMessage(
          result.error ?? "Impossible de clôturer la campagne."
        );
        return;
      }

      setCloseMessage(
        `Campagne clôturée. Prix final : ${result.finalUnitPrice.toLocaleString(
          "fr-FR"
        )} FCFA. ${result.ordersUpdated} commande(s) mise(s) à jour.`
      );

      await loadDashboard();
    } catch {
      setCloseMessage("Impossible de contacter le serveur.");
    } finally {
      setClosing(false);
    }
  }

  async function updateOrderStatus(orderId: number, status: string) {
    const confirmed = window.confirm(
      `Voulez-vous vraiment changer le statut de la commande #${orderId} ?`
    );

    if (!confirmed) {
      return;
    }

    setUpdatingOrderId(orderId);

    try {
      const response = await fetch("/api/admin/orders/status", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId,
          status,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        alert(result.error ?? "Impossible de modifier le statut.");
        return;
      }

      await loadDashboard();
    } catch {
      alert("Impossible de contacter le serveur.");
    } finally {
      setUpdatingOrderId(null);
    }
  }

  async function logout() {
    try {
      await fetch("/api/admin/logout", {
        method: "POST",
      });
    } finally {
      window.location.href = "/admin/login";
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-6xl">
          <p className="text-slate-500">Chargement des données...</p>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-3xl bg-white p-8">
            <p className="font-bold text-red-600">
              Impossible de charger le dashboard.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const { campaigns, statistics, orders } = data;

  const campaign =
    campaigns.find((item) => item.id === selectedCampaignId) ??
    campaigns[0] ??
    null;

  const progress = campaign
    ? Math.min(
        100,
        Math.round(
          (campaign.currentQuantity / campaign.targetQuantity) * 100
        )
      )
    : 0;

  const currentTier =
    campaign?.priceTiers
      .filter(
        (tier) =>
          campaign.currentQuantity >= tier.minQuantity &&
          campaign.currentQuantity <= tier.maxQuantity
      )
      .at(0) ?? null;

  const nextTier =
    campaign?.priceTiers
      .filter(
        (tier) =>
          tier.minQuantity > (campaign?.currentQuantity ?? 0)
      )
      .at(0) ?? null;

  const normalizedSearch = orderSearch.trim().toLowerCase();

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      normalizedSearch === "" ||
      order.customer.toLowerCase().includes(normalizedSearch) ||
      order.phone.toLowerCase().includes(normalizedSearch);

    let matchesFilter = true;

    switch (orderFilter) {
      case "PAYMENT_PENDING":
        matchesFilter = order.paymentStatus !== "PAID";
        break;

      case "TO_CONFIRM":
        matchesFilter =
          order.orderStatus === "PENDING" &&
          order.paymentStatus === "PAID";
        break;

      case "TO_PREPARE":
        matchesFilter =
          order.orderStatus === "CONFIRMED" &&
          order.deliveryStatus === "PENDING";
        break;

      case "IN_DELIVERY":
        matchesFilter =
          order.deliveryStatus === "OUT_FOR_DELIVERY";
        break;

      case "DELIVERED":
        matchesFilter =
          order.orderStatus === "DELIVERED" ||
          order.deliveryStatus === "DELIVERED";
        break;

      case "CANCELLED":
        matchesFilter = order.orderStatus === "CANCELLED";
        break;

      default:
        matchesFilter = true;
    }

    return matchesSearch && matchesFilter;
  });

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-black text-slate-900">
              Dashboard Admin
            </h1>

            <p className="mt-2 text-slate-500">
              Vue d&apos;ensemble de SamaAchat
            </p>
          </div>

          <button
            onClick={logout}
            className="rounded-xl bg-red-600 px-5 py-3 font-bold text-white hover:bg-red-700"
          >
            Se déconnecter
          </button>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-sm font-bold text-slate-500">Clients</p>

            <p className="mt-2 text-3xl font-black text-slate-900">
              {statistics.customers}
            </p>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-sm font-bold text-slate-500">Commandes</p>

            <p className="mt-2 text-3xl font-black text-slate-900">
              {statistics.orders}
            </p>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-sm font-bold text-slate-500">
              Commandes payées
            </p>

            <p className="mt-2 text-3xl font-black text-green-700">
              {statistics.paidOrders}
            </p>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-sm font-bold text-slate-500">
              Chiffre d&apos;affaires
            </p>

            <p className="mt-2 text-2xl font-black text-green-700">
              {statistics.totalRevenue.toLocaleString("fr-FR")} FCFA
            </p>
          </div>
        </div>

        {campaigns.length > 0 && (
          <div className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
            <label className="text-sm font-bold text-slate-500">
              CAMPAGNE À GÉRER
            </label>

            <select
              value={selectedCampaignId ?? ""}
              onChange={(event) =>
                setSelectedCampaignId(Number(event.target.value))
              }
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-900"
            >
              {campaigns.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.product}
                </option>
              ))}
            </select>
          </div>
        )}

        {campaign && (
          <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm md:p-8">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
              <div>
                <p className="text-sm font-bold text-green-700">
                  CAMPAGNE ACTIVE
                </p>

                <h2 className="mt-1 text-2xl font-black text-slate-900">
                  {campaign.product}
                </h2>

                <p className="mt-1 text-slate-500">
                  Objectif : {campaign.targetQuantity}{" "}
                  {campaign.unit ?? "unités"}
                </p>
              </div>

              <div className="rounded-2xl bg-green-50 px-5 py-3 text-center">
                <p className="text-xs font-bold text-slate-500">
                  PRIX ACTUEL
                </p>

                <p className="text-2xl font-black text-green-700">
                  {currentTier
                    ? currentTier.price.toLocaleString("fr-FR")
                    : "—"}{" "}
                  FCFA
                </p>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={closeCampaign}
                disabled={closing}
                className="rounded-2xl bg-red-600 px-5 py-3 font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {closing
                  ? "Clôture en cours..."
                  : "Clôturer la campagne"}
              </button>

              {closeMessage && (
                <p className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-700">
                  {closeMessage}
                </p>
              )}
            </div>

            <div className="mt-8">
              <div className="flex items-end justify-between">
                <p className="text-3xl font-black text-slate-900">
                  {campaign.currentQuantity}
                  <span className="text-lg text-slate-400">
                    {" "}
                    / {campaign.targetQuantity}{" "}
                    {campaign.unit ?? "unités"}
                  </span>
                </p>

                <p className="text-xl font-black text-green-700">
                  {progress}%
                </p>
              </div>

              <div className="mt-3 h-4 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-green-600 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {nextTier && (
              <div className="mt-6 rounded-2xl border border-yellow-200 bg-yellow-50 p-5">
                <p className="text-sm font-bold text-yellow-800">
                  PROCHAIN PALIER
                </p>

                <p className="mt-1 text-lg font-black text-slate-900">
                  Encore{" "}
                  {nextTier.minQuantity - campaign.currentQuantity}{" "}
                  {campaign.unit ?? "unités"} pour atteindre{" "}
                  {nextTier.price.toLocaleString("fr-FR")} FCFA /{" "}
                  {campaign.unit ?? "unité"}
                </p>
              </div>
            )}

            <div className="mt-8">
              <h3 className="text-lg font-black text-slate-900">
                Paliers de prix
              </h3>

              <div className="mt-4 space-y-3">
                {campaign.priceTiers.map((tier) => {
                  const active =
                    campaign.currentQuantity >= tier.minQuantity &&
                    campaign.currentQuantity <= tier.maxQuantity;

                  return (
                    <div
                      key={tier.minQuantity}
                      className={`flex items-center justify-between rounded-2xl p-4 ${
                        active
                          ? "bg-green-50 ring-2 ring-green-600"
                          : "bg-slate-50"
                      }`}
                    >
                      <div>
                        <p className="font-bold text-slate-900">
                          {tier.minQuantity} –{" "}
                          {tier.maxQuantity >= 999999
                            ? "∞"
                            : tier.maxQuantity}{" "}
                          {campaign.unit ?? "unités"}
                        </p>

                        {active && (
                          <p className="mt-1 text-xs font-bold text-green-700">
                            PALIER ACTUEL
                          </p>
                        )}
                      </div>

                      <p className="text-lg font-black text-slate-900">
                        {tier.price.toLocaleString("fr-FR")} FCFA
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        <div className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-sm font-bold text-slate-500">
            Volume total commandé
          </p>

          <p className="mt-2 text-3xl font-black text-slate-900">
            {statistics.totalQuantity} unité
            {statistics.totalQuantity > 1 ? "s" : ""}
          </p>
        </div>

        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-900">
                Commandes
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Toutes les commandes SamaAchat
              </p>
            </div>

            <span className="w-fit rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600">
              {filteredOrders.length} / {orders.length}
            </span>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-[1fr_auto]">
            <input
              type="search"
              value={orderSearch}
              onChange={(event) => setOrderSearch(event.target.value)}
              placeholder="Rechercher par nom ou téléphone..."
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
            />

            <select
              value={orderFilter}
              onChange={(event) => setOrderFilter(event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
            >
              <option value="ALL">Toutes</option>
              <option value="PAYMENT_PENDING">
                Paiement en attente
              </option>
              <option value="TO_CONFIRM">À confirmer</option>
              <option value="TO_PREPARE">À préparer</option>
              <option value="IN_DELIVERY">En livraison</option>
              <option value="DELIVERED">Livrées</option>
              <option value="CANCELLED">Annulées</option>
            </select>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="mt-6 rounded-2xl bg-slate-50 p-6 text-center">
              <p className="font-bold text-slate-700">
                Aucune commande ne correspond à votre recherche.
              </p>
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[1250px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="px-4 py-3 font-bold">Commande</th>
                    <th className="px-4 py-3 font-bold">Client</th>
                    <th className="px-4 py-3 font-bold">Téléphone</th>
                    <th className="px-4 py-3 font-bold">Adresse</th>
                    <th className="px-4 py-3 font-bold">Quantité</th>
                    <th className="px-4 py-3 font-bold">Montant</th>
                    <th className="px-4 py-3 font-bold">Paiement</th>
                    <th className="px-4 py-3 font-bold">Statut</th>
                    <th className="px-4 py-3 font-bold">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="px-4 py-4 font-black">
                        #{order.id}
                      </td>

                      <td className="px-4 py-4 font-bold">
                        {order.customer}
                      </td>

                      <td className="px-4 py-4 text-slate-500">
                        {order.phone}
                      </td>

                      <td className="px-4 py-4">
                        <div className="space-y-2">
                          {order.items.map((item) => (
                            <div
                              key={item.campaignId}
                              className="rounded-lg bg-slate-50 px-3 py-2"
                            >
                              <p className="font-bold text-slate-700">
                                🛒 {item.product}
                              </p>

                              <p className="text-sm text-slate-500">
                                {item.quantity} ×{" "}
                                {item.unitPrice.toLocaleString(
                                  "fr-FR"
                                )}{" "}
                                FCFA
                              </p>
                            </div>
                          ))}
                        </div>
                      </td>

                      <td className="max-w-[280px] px-4 py-4">
                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="font-semibold text-slate-700">
                            📍{" "}
                            {order.address ||
                              "Adresse non renseignée"}
                          </p>

                          <select
                            value={order.deliveryStatus}
                            onChange={async (event) => {
                              const newStatus = event.target.value;

                              try {
                                const response = await fetch(
                                  "/api/admin/delivery/status",
                                  {
                                    method: "PATCH",
                                    headers: {
                                      "Content-Type":
                                        "application/json",
                                    },
                                    body: JSON.stringify({
                                      orderId: order.id,
                                      status: newStatus,
                                    }),
                                  }
                                );

                                const result =
                                  await response.json();

                                if (!response.ok) {
                                  alert(
                                    result.error ??
                                      "Impossible de modifier le statut de livraison."
                                  );
                                  return;
                                }

                                await loadDashboard();
                              } catch {
                                alert(
                                  "Impossible de contacter le serveur."
                                );
                              }
                            }}
                            className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"
                          >
                            <option value="PENDING">
                              En attente
                            </option>
                            <option value="PREPARING">
                              En préparation
                            </option>
                            <option value="OUT_FOR_DELIVERY">
                              En livraison
                            </option>
                            <option value="DELIVERED">
                              Livrée
                            </option>
                          </select>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        {order.quantity} unité
                        {order.quantity > 1 ? "s" : ""}
                      </td>

                      <td className="px-4 py-4 font-black">
                        {order.amount.toLocaleString("fr-FR")} FCFA
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={
                            order.paymentStatus === "PAID"
                              ? "rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700"
                              : "rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-700"
                          }
                        >
                          {order.paymentStatus === "PAID"
                            ? "Payée"
                            : "En attente"}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={
                            order.orderStatus === "CONFIRMED"
                              ? "rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700"
                              : order.orderStatus === "DELIVERED"
                                ? "rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700"
                                : order.orderStatus === "CANCELLED"
                                  ? "rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700"
                                  : "rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600"
                          }
                        >
                          {order.orderStatus === "CONFIRMED"
                            ? "Confirmée"
                            : order.orderStatus === "DELIVERED"
                              ? "Livrée"
                              : order.orderStatus === "CANCELLED"
                                ? "Annulée"
                                : "En attente"}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          {order.orderStatus === "PENDING" &&
                            order.paymentStatus === "PAID" && (
                              <button
                                onClick={() =>
                                  updateOrderStatus(
                                    order.id,
                                    "CONFIRMED"
                                  )
                                }
                                disabled={
                                  updatingOrderId === order.id
                                }
                                className="rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {updatingOrderId === order.id
                                  ? "..."
                                  : "Confirmer"}
                              </button>
                            )}

                          {order.orderStatus === "PENDING" &&
                            order.paymentStatus !== "PAID" && (
                              <span className="rounded-lg bg-yellow-50 px-3 py-2 text-xs font-bold text-yellow-700">
                                Paiement requis
                              </span>
                            )}

                          {order.orderStatus !== "DELIVERED" &&
                            order.orderStatus !== "CANCELLED" && (
                              <button
                                onClick={() =>
                                  updateOrderStatus(
                                    order.id,
                                    "CANCELLED"
                                  )
                                }
                                disabled={
                                  updatingOrderId === order.id
                                }
                                className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Annuler
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}