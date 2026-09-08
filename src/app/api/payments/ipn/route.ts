import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

function safeEqual(a: string, b: string) {
  if (!a || !b || a.length !== b.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(a, "utf8"),
    Buffer.from(b, "utf8")
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const typeEvent = String(body.type_event ?? "");
    const refCommand = String(body.ref_command ?? "");
    const itemPrice = Number(
      body.final_item_price ?? body.item_price ?? 0
    );

    const receivedHmac = String(body.hmac_compute ?? "");

    const apiKey = process.env.PAYTECH_API_KEY;
    const apiSecret = process.env.PAYTECH_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.error("Variables PayTech manquantes.");
      return new NextResponse("Configuration error", {
        status: 500,
      });
    }

    // ---------------------------------------------------------
    // 1. Vérification de l'authenticité PayTech
    // ---------------------------------------------------------

    let authenticated = false;

    // Méthode recommandée : HMAC-SHA256
    if (receivedHmac) {
      const message = `${itemPrice}|${refCommand}|${apiKey}`;

      const expectedHmac = crypto
        .createHmac("sha256", apiSecret)
        .update(message)
        .digest("hex");

      authenticated = safeEqual(expectedHmac, receivedHmac);
    }

    // Méthode alternative : SHA256 des clés
    if (!authenticated) {
      const receivedApiKeyHash = String(
        body.api_key_sha256 ?? ""
      );

      const receivedApiSecretHash = String(
        body.api_secret_sha256 ?? ""
      );

      const expectedApiKeyHash = crypto
        .createHash("sha256")
        .update(apiKey)
        .digest("hex");

      const expectedApiSecretHash = crypto
        .createHash("sha256")
        .update(apiSecret)
        .digest("hex");

      authenticated =
        safeEqual(expectedApiKeyHash, receivedApiKeyHash) &&
        safeEqual(expectedApiSecretHash, receivedApiSecretHash);
    }

    if (!authenticated) {
      console.error("IPN PayTech rejeté : authentification invalide.");

      return new NextResponse("Forbidden", {
        status: 403,
      });
    }

    // ---------------------------------------------------------
    // 2. Vérification de l'événement
    // ---------------------------------------------------------

    if (
      typeEvent !== "sale_complete" &&
      typeEvent !== "sale_canceled"
    ) {
      console.log("Événement PayTech ignoré :", typeEvent);

      return new NextResponse("OK", {
        status: 200,
      });
    }

    // ---------------------------------------------------------
    // 3. Vérification de la référence
    // ---------------------------------------------------------

    if (!refCommand.startsWith("SAMA-ORDER-")) {
      console.error(
        "Référence PayTech invalide :",
        refCommand
      );

      return new NextResponse("Invalid reference", {
        status: 400,
      });
    }

    const orderId = Number(
      refCommand.replace("SAMA-ORDER-", "")
    );

    if (!Number.isInteger(orderId) || orderId < 1) {
      return new NextResponse("Invalid order", {
        status: 400,
      });
    }

    // ---------------------------------------------------------
    // 4. Recherche de la commande
    // ---------------------------------------------------------

    const order = await prisma.order.findUnique({
      where: {
        id: orderId,
      },
      include: {
        payment: true,
      },
    });

    if (!order) {
      console.error(
        "Commande introuvable pour IPN PayTech :",
        orderId
      );

      return new NextResponse("Order not found", {
        status: 404,
      });
    }

    // ---------------------------------------------------------
    // 5. Vérification du montant
    // ---------------------------------------------------------

    if (itemPrice !== order.amount) {
      console.error("Montant PayTech différent :", {
        orderId,
        expected: order.amount,
        received: itemPrice,
      });

      return new NextResponse("Invalid amount", {
        status: 400,
      });
    }

    // ---------------------------------------------------------
    // 6. Paiement réussi
    // ---------------------------------------------------------

    if (typeEvent === "sale_complete") {
      await prisma.$transaction(async (tx) => {
        await tx.payment.upsert({
          where: {
            orderId: order.id,
          },
          update: {
            amount: order.amount,
            provider: "PAYTECH",
            status: "PAID",
          },
          create: {
            orderId: order.id,
            amount: order.amount,
            provider: "PAYTECH",
            status: "PAID",
          },
        });

        await tx.order.update({
          where: {
            id: order.id,
          },
          data: {
            status: "CONFIRMED",
          },
        });
      });

      console.log(
        `Paiement PayTech confirmé pour la commande #${order.id}`
      );

      return new NextResponse("OK", {
        status: 200,
      });
    }

    // ---------------------------------------------------------
    // 7. Paiement annulé
    // ---------------------------------------------------------

    if (typeEvent === "sale_canceled") {
      await prisma.payment.upsert({
        where: {
          orderId: order.id,
        },
        update: {
          amount: order.amount,
          provider: "PAYTECH",
          status: "FAILED",
        },
        create: {
          orderId: order.id,
          amount: order.amount,
          provider: "PAYTECH",
          status: "FAILED",
        },
      });

      console.log(
        `Paiement PayTech annulé pour la commande #${order.id}`
      );

      return new NextResponse("OK", {
        status: 200,
      });
    }

    return new NextResponse("OK", {
      status: 200,
    });
  } catch (error) {
    console.error("Erreur IPN PayTech :", error);

    return new NextResponse("Internal Server Error", {
      status: 500,
    });
  }
}