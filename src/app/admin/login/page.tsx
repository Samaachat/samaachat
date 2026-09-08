"use client";

import { useState } from "react";

export default function AdminLoginPage() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();

  try {
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
  phone,
  password,
}),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error ?? "Connexion refusée.");
      return;
    }

    window.location.href = "/admin/dashboard";
  } catch {
    alert("Impossible de contacter le serveur.");
  }
}

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto flex min-h-screen max-w-md items-center px-5">
        <div className="w-full rounded-3xl bg-white p-7 shadow-sm">
          <div className="text-center">
            <a
              href="/"
              className="text-3xl font-extrabold text-green-700"
            >
              Sama<span className="text-yellow-500">Achat</span>
            </a>

            <h1 className="mt-6 text-2xl font-black text-slate-900">
              Connexion administrateur
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Connectez-vous pour accéder au tableau de bord.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            <div>
              <label className="text-sm font-bold text-slate-700">
                Numéro de téléphone
              </label>

              <input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Ex. 771234567"
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-green-600"
                required
              />
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700">
                Mot de passe
              </label>

              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Votre mot de passe"
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-green-600"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-green-700 px-5 py-3 font-bold text-white hover:bg-green-800"
            >
              Se connecter
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}