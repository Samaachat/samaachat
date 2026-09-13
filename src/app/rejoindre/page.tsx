"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCampaignUnitPrice } from "@/lib/campaign-prices";

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

  function getPrice(campaign: Campaign) {
    return getCampaignUnitPrice(campaign.product.name);
  }

  function getCampaignImage(productName: string) {
    const name = productName.toLowerCase();

    if (name.includes("riz")) return "/images/campagnes/riz-50kg.png";
    if (name.includes("huile")) return "/images/campagnes/huile-5l.png";
    if (name.includes("oignon")) return "/images/campagnes/oignon-25kg.png";
    if (name.includes("sucre")) return "/images/campagnes/sucre-50kg.png";
    if (name.includes("pomme") || name.includes("terre")) {
      return "/images/campagnes/pomme-de-terre-25kg.png";
    }
    return null;
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
                price: getPrice(campaign),
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
        const price = getPrice(campaign);

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

                  const price = getPrice(campaign);
                  const campaignImage = getCampaignImage(campaign.product.name);

                  const productTotal =
                    quantity *
                    price;

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
                      <div className="grid gap-6 md:grid-cols-[280px_1fr] md:items-center">
                        {campaignImage && (
                          <div className="flex h-56 items-center justify-center overflow-hidden rounded-2xl bg-slate-50 p-4 md:h-full">
                            <img
                              src={campaignImage}
                              alt={campaign.product.name}
                              className="h-full w-full object-contain object-center"
                            />
                          </div>
                        )}

                        <div>
                          <p className="text-sm font-bold text-green-700">
                            ACHAT GROUPÉ
                          </p>

                          <h2 className="mt-1 text-2xl font-black">
                            {
                              campaign
                                .product
                                .name
                            }
                          </h2>

                          <p className="mt-1 text-sm text-slate-500">
                            {
                              campaign
                                .product
                                .description
                            }
                          </p>

                          <p className="mt-3 font-bold text-green-700">
                            {price.toLocaleString(
                              "fr-FR"
                            )}{" "}
                            FCFA /{" "}
                            {campaign.product.unit.toLowerCase()}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {
                              campaign.currentQuantity
                            }{" "}
                            /{" "}
                            {
                              campaign.targetQuantity
                            }{" "}
                            déjà commandés
                          </p>
                        </div>

                        <div className="flex items-center justify-between rounded-2xl border border-slate-200 p-3 md:w-64">
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

                      {quantity >
                        0 && (
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