import { Suspense } from "react";
import InscriptionContent from "./InscriptionContent";

export default function InscriptionPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
          <p className="font-bold text-slate-600">
            Chargement...
          </p>
        </main>
      }
    >
      <InscriptionContent />
    </Suspense>
  );
}