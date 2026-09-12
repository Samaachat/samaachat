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

type CartItem = {
  campaignId: number;
  quantity: number;
};

type SelectedProduct = {
  campaignId: number;
  quantity: number;
  price: number;
};

function getCampaignImage(productName: string) {
  const name = productName.toLowerCase();

  if (name.includes("riz")) {
    return {
      src: "/images/campagnes/riz-50kg.png",
      alt: "Riz brisé ordinaire 50 kg",
    };
  }

  if (name.includes("huile")) {
    return {
      src: "/images/campagnes/huile-5l.png",
      alt: "Huile végétale 5 litres",
    };
  }

  if (name.includes("oignon")) {
    return {
      src: "/images/campagnes/oignon-25kg.png",
      alt: "Oignon 25 kg",
    };
  }

  if (name.includes("sucre")) {
    return {
      src: "/images/campagnes/sucre-50kg.png",
      alt: "Sucre 50 kg",
    };
  }

  if (name.includes("pomme") && name.includes("terre")) {
    return {
      src: "/images/campagnes/pomme-de-terre-25kg.png",
      alt: "Pomme de terre 25 kg",
    };
  }

  return null;
}

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

  function getPrice(
    campaign: Campaign,
    quantity: number
  ) {
    const tier = campaign.priceTiers.find(
      (tier) =>
        quantity >= tier.minQuantity &&
        quantity <= tier.maxQuantity
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
        const response = await fetch("/api/campaigns");

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
         * Récupération du panier enregistré
         * sur la page d'accueil.
         */
        let savedCart: CartItem[] = [];

        try {
          const saved = localStorage.getItem(
            "samaachat-cart"
          );

          if (saved) {
            savedCart = JSON.parse(saved);
          }
        } catch (error) {
          console.error(
            "Erreur lecture panier :",
            error
          );
        }

        /*
         * Si un campaignId est présent dans l'URL,
         * on ajoute aussi ce produit au panier.
         *
         * Cela permet de garder la compatibilité
         * avec les anciens liens.
         */
        const params = new URLSearchParams(
          window.location.search
        );

        const campaignIdParam =
          params.get("campaignId");

        if (campaignIdParam) {
          const campaignId = Number(
            campaignIdParam
          );

          const existingItem = savedCart.find(
            (item) =>
              item.campaignId === campaignId
          );

          if (existingItem) {
            existingItem.quantity += 1;
          } else {
            savedCart.push({
              campaignId,
              quantity: 1,
            });
          }

          localStorage.setItem(
            "samaachat-cart",
            JSON.stringify(savedCart)
          );
        }

        /*
         * Transformation du panier sauvegardé
         * en produits sélectionnés avec leur prix.
         */
        const selectedProducts: SelectedProduct[] =
          savedCart
            .map((item) => {
              const campaign =
                loadedCampaigns.find(
                  (campaign) =>
                    campaign.id ===
                    item.campaignId
                );

              if (!campaign) {
                return null;
              }

              return {
                campaignId: campaign.id,
                quantity: item.quantity,
                price: getPrice(
                  campaign,
                  item.quantity
                ),
              };
            })
            .filter(
              (
                item
              ): item is SelectedProduct =>
                item !== null
            );

        setSelected(selectedProducts);
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

  function saveCart(
    products: SelectedProduct[]
  ) {
    const cart: CartItem[] = products
      .filter((item) => item.quantity > 0)
      .map((item) => ({
        campaignId: item.campaignId,
        quantity: item.quantity,
      }));

    localStorage.setItem(
      "samaachat-cart",
      JSON.stringify(cart)
    );
  }

  function getQuantity(campaignId: number) {
    return (
      selected.find(
        (item) =>
          item.campaignId === campaignId
      )?.quantity ?? 0
    );
  }

  function updateQuantity(
    campaign: Campaign,
    quantity: number
  ) {
    const safeQuantity = Math.max(
      0,
      quantity
    );

    setSelected((current) => {
      let updated: SelectedProduct[];

      if (safeQuantity === 0) {
        updated = current.filter(
          (item) =>
            item.campaignId !==
            campaign.id
        );
      } else {
        const price = getPrice(
          campaign,
          safeQuantity
        );

        const existing = current.find(
          (item) =>
            item.campaignId ===
            campaign.id
        );

        if (existing) {
          updated = current.map((item) =>
            item.campaignId ===
            campaign.id
              ? {
                  ...item,
                  quantity:
                    safeQuantity,
                  price,
                }
              : item
          );
        } else {
          updated = [
            ...current,
            {
              campaignId:
                campaign.id,
              quantity:
                safeQuantity,
              price,
            },
          ];
        }
      }

      saveCart(updated);

      return updated;
    });
  }

  const total = selected.reduce(
    (sum, item) =>
      sum +
      item.quantity *
        item.price,
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

    if (
      !name.trim() ||
      !phone.trim()
    ) {
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
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            name,
            phone,
            address,
            items: selected,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        setError(
          data.error ||
            "Une erreur est survenue."
        );
        return;
      }

      /*
       * La commande doit maintenant
       * posséder son code d'accès privé.
       */
      if (!data.accessToken) {
        setError(
          "La commande a été créée mais son code d'accès est manquant."
        );
        return;
      }

      /*
       * On sauvegarde le token localement.
       *
       * Il permettra ensuite au client
       * d'accéder à sa commande sans exposer
       * simplement son numéro de commande.
       */
      localStorage.setItem(
        `samaachat_order_${data.orderId}`,
        JSON.stringify({
          orderId: data.orderId,
          accessToken: data.accessToken,
        })
      );

      /*
       * Commande créée :
       * on vide le panier.
       */
      localStorage.removeItem(
        "samaachat-cart"
      );

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
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4">
          <a
            href="/"
            className="text-2xl font-extrabold text-green-700"
          >
            Sama
            <span className="text-yellow-500">
              Achat
            </span>
          </a>

          <a
            href="/commandes"
            className="text-sm font-semibold text-green-700 hover:underline"
          >
            Mes commandes
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-5 py-8">
        <a
          href="/"
          className="text-sm font-semibold text-green-700 hover:underline"
        >
          ← Continuer mes achats
        </a>

        <div className="mt-6">
          <h1 className="text-3xl font-black">
            Votre panier
          </h1>

          <p className="mt-2 text-slate-500">
            Vérifiez vos produits avant de passer commande.
          </p>
        </div>

        {campaignLoading ? (
          <div className="mt-8 rounded-3xl bg-white p-8 text-center shadow-lg">
            Chargement du panier...
          </div>
        ) : (
          <>
            <div className="mt-8 space-y-5">
              {campaigns.map(
                (campaign) => {
                  const quantity =
                    getQuantity(
                      campaign.id
                    );

                  const price =
                    getPrice(
                      campaign,
                      quantity || 1
                    );

                  const productTotal =
                    quantity *
                    price;

                  const campaignImage = getCampaignImage(
                    campaign.product.name
                  );

                  return (
                    <div
                      key={
                        campaign.id
                      }
                      className={`rounded-3xl bg-white p-6 shadow-lg ${
                        quantity > 0
                          ? "ring-2 ring-green-500"
                          : ""
                      }`}
                    >
                      <div
                        className={
                          campaignImage
                            ? "grid gap-6 md:grid-cols-[280px_1fr] md:items-stretch"
                            : ""
                        }
                      >
                        {campaignImage && (
                          <div className="overflow-hidden rounded-2xl bg-slate-100">
                            <img
                              src={campaignImage.src}
                              alt={campaignImage.alt}
                              className="h-56 w-full object-cover md:h-full"
                            />
                          </div>
                        )}

                        <div className="flex flex-col justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-black uppercase tracking-wide text-green-800">
                                ACHAT GROUPÉ
                              </span>
                              <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-800">
                                Prix dégressifs
                              </span>
                            </div>

                            <h2 className="mt-3 text-2xl font-black text-slate-950 md:text-3xl">
                              {campaign.product.name}
                            </h2>

                          <p className="mt-1 text-sm text-slate-500">
                            {
                              campaign
                                .product
                                .description
                            }
                          </p>

                          <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                                Prix actuel
                              </p>
                              <p className="mt-1 text-2xl font-black text-green-700">
                                {price.toLocaleString(
                                  "fr-FR"
                                )}{" "}
                                FCFA
                                <span className="ml-1 text-sm font-bold text-slate-500">
                                  / {campaign.product.unit.toLowerCase()}
                                </span>
                              </p>
                            </div>
                            <p className="text-sm font-bold text-slate-600">
                              {campaign.currentQuantity} / {campaign.targetQuantity}
                            </p>
                          </div>

                          <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-green-600 transition-all"
                              style={{
                                width: `${Math.min(
                                  100,
                                  (campaign.currentQuantity /
                                    Math.max(1, campaign.targetQuantity)) *
                                    100
                                )}%`,
                              }}
                            />
                          </div>

                          <p className="mt-2 text-xs font-medium text-slate-500">
                            Plus nous sommes nombreux, plus le prix baisse.
                          </p>
                        </div>

                        <div className="mt-5 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-3 md:mt-0 md:w-64 md:self-end">
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(
                                campaign,
                                quantity -
                                  1
                              )
                            }
                            className="h-12 w-12 rounded-xl bg-slate-100 text-2xl font-bold"
                          >
                            −
                          </button>

                          <div className="text-center">
                            <p className="text-3xl font-black">
                              {
                                quantity
                              }
                            </p>

                            <p className="text-xs text-slate-500">
                              {
                                campaign
                                  .product
                                  .unit
                              }
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(
                                campaign,
                                quantity +
                                  1
                              )
                            }
                            className="h-12 w-12 rounded-xl bg-green-100 text-2xl font-bold text-green-700"
                          >
                            +
                          </button>
                        </div>
                      </div>

                        {quantity > 0 && (
                          <div className="mt-5 rounded-2xl bg-green-50 px-4 py-3 text-right">
                            <span className="text-sm font-medium text-slate-500">
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
                    </div>
                  );
                }
              )}
            </div>

            {selected.length >
              0 && (
              <div className="mt-6 rounded-3xl bg-green-50 p-6">
                <h2 className="text-xl font-black text-green-950">
                  🛒 Résumé du panier
                </h2>

                <div className="mt-4 space-y-3">
                  {selected.map(
                    (item) => {
                      const campaign =
                        campaigns.find(
                          (
                            campaign
                          ) =>
                            campaign.id ===
                            item.campaignId
                        );

                      if (!campaign) {
                        return null;
                      }

                      return (
                        <div
                          key={
                            item.campaignId
                          }
                        
                          className="flex items-center justify-between border-b border-green-100 pb-3"
                        >
                          <div>
                            <p className="font-bold text-slate-900">
                              {
                                campaign
                                  .product
                                  .name
                              }
                            </p>

                            <p className="text-sm text-slate-500">
                              {
                                item.quantity
                              }{" "}
                              ×{" "}
                              {item.price.toLocaleString(
                                "fr-FR"
                              )}{" "}
                              FCFA
                            </p>
                          </div>

                          <p className="font-black text-green-700">
                            {(
                              item.quantity *
                              item.price
                            ).toLocaleString(
                              "fr-FR"
                            )}{" "}
                            FCFA
                          </p>
                        </div>
                      );
                    }
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className="font-semibold text-slate-600">
                    {totalItems}{" "}
                    produit
                    {totalItems >
                    1
                      ? "s"
                      : ""}
                  </span>

                  <span className="text-2xl font-black text-green-700">
                    {total.toLocaleString(
                      "fr-FR"
                    )}{" "}
                    FCFA
                  </span>
                </div>
              </div>
            )}
          </>
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
                  setName(
                    e.target.value
                  )
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
                  setPhone(
                    e.target.value
                  )
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
                  setAddress(
                    e.target.value
                  )
                }
                placeholder="Ex : Parcelles Assainies, Unité 15, près de..."
                rows={3}
                className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-green-600"
              />

              <p className="mt-2 text-xs text-slate-500">
                Indiquez votre quartier, zone et un repère si possible.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={
            handleSubmit
          }
          disabled={
            loading ||
            campaignLoading
          }
          className="mt-6 w-full rounded-2xl bg-yellow-400 px-6 py-4 text-lg font-black text-slate-900 hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading
            ? "Enregistrement..."
            : "Confirmer ma commande →"}
        </button>

        <p className="mt-4 text-center text-xs text-slate-500">
          Vos informations seront utilisées uniquement pour traiter
          votre commande et organiser la livraison.
        </p>
      </div>
    </main>
  );
}