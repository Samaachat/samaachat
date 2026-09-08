import Link from "next/link";
import { getActiveCampaigns } from "@/lib/campaign";

export const dynamic = "force-dynamic";

export default async function CampagnesPage() {
  const campaigns = await getActiveCampaigns();

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
            href="/commandes"
            className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700"
          >
            Mes commandes
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="max-w-2xl">
          <p className="font-bold text-yellow-600">
            ACHETEZ ENSEMBLE
          </p>

          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900">
            Les achats groupés du moment
          </h1>

          <p className="mt-4 text-lg text-slate-600">
            Plus nous achetons ensemble, plus le prix peut baisser.
          </p>
        </div>

        {campaigns.length === 0 ? (
          <div className="mt-10 rounded-3xl bg-white p-8 text-center shadow-sm">
            <p className="text-lg font-bold text-slate-900">
              Aucune campagne active pour le moment.
            </p>

            <p className="mt-2 text-slate-500">
              Revenez bientôt pour découvrir les prochaines offres.
            </p>
          </div>
        ) : (
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((campaign) => {
              const progress =
                campaign.targetQuantity > 0
                  ? Math.min(
                      100,
                      Math.round(
                        (campaign.currentQuantity /
                          campaign.targetQuantity) *
                          100
                      )
                    )
                  : 0;

              const currentTier =
                campaign.priceTiers
                  .filter(
                    (tier) =>
                      campaign.currentQuantity >= tier.minQuantity &&
                      campaign.currentQuantity <= tier.maxQuantity
                  )
                  .at(0) ?? campaign.priceTiers.at(0);

              const nextTier = campaign.priceTiers
                .filter(
                  (tier) =>
                    tier.minQuantity > campaign.currentQuantity
                )
                .at(0);

              return (
                <article
                  key={campaign.id}
                  className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200"
                >
                  <div className="flex h-48 items-center justify-center bg-green-50">
                    <span className="text-7xl">🛒</span>
                  </div>

                  <div className="p-6">
                    <p className="text-sm font-bold text-green-700">
                      CAMPAGNE ACTIVE
                    </p>

                    <h2 className="mt-1 text-2xl font-black text-slate-900">
                      {campaign.product.name}
                    </h2>

                    <p className="mt-2 text-slate-500">
                      Objectif : {campaign.targetQuantity} unités
                    </p>

                    <div className="mt-5">
                      <div className="flex items-center justify-between text-sm font-bold">
                        <span>
                          {campaign.currentQuantity} commandées
                        </span>

                        <span className="text-green-700">
                          {progress}%
                        </span>
                      </div>

                      <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-green-600"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-6 rounded-2xl bg-green-50 p-4">
                      <p className="text-sm font-bold text-slate-500">
                        PRIX ACTUEL
                      </p>

                      <p className="mt-1 text-3xl font-black text-green-700">
                        {currentTier
                          ? currentTier.price.toLocaleString("fr-FR")
                          : "—"}{" "}
                        FCFA
                      </p>

                      <p className="text-sm text-slate-500">
                        par unité
                      </p>
                    </div>

                    {nextTier && (
                      <p className="mt-4 text-sm font-bold text-slate-600">
                        Encore{" "}
                        {nextTier.minQuantity -
                          campaign.currentQuantity}{" "}
                        unité
                        {nextTier.minQuantity -
                          campaign.currentQuantity >
                        1
                          ? "s"
                          : ""}{" "}
                        pour atteindre{" "}
                        {nextTier.price.toLocaleString("fr-FR")}{" "}
                        FCFA.
                      </p>
                    )}

                    <Link
                      href={`/campagnes/${campaign.id}`}
                      className="mt-6 block rounded-2xl bg-green-700 px-5 py-4 text-center font-black text-white transition hover:bg-green-800"
                    >
                      Voir la campagne →
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="mt-12 rounded-3xl bg-green-700 p-6 text-white md:p-8">
          <h2 className="text-2xl font-black">
            🧺 Bientôt : les paniers SamaAchat
          </h2>

          <p className="mt-2 max-w-2xl text-green-50">
            Riz, huile, sucre, oignon, pomme de terre et autres
            produits essentiels réunis dans un seul panier.
          </p>
        </div>
      </section>
    </main>
  );
}