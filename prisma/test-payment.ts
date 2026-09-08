import { prisma } from "../src/lib/prisma";

async function main() {
  const response = await fetch("http://localhost:3000/api/payments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      orderId: 1,
      provider: "TEST",
    }),
  });

  const data = await response.json();

  console.log("RÉSULTAT DU PAIEMENT :");
  console.log(data);
}

main().catch(console.error);