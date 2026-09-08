import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const PAYTECH_API_URL = "https://paytech.sn/api/payment/request-payment";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const orderId = Number(body.orderId);
    const provider = String(body.provider ?? "TEST").trim().toUpperCase();

    if (!Number.isInteger(orderId) || orderId < 1) {
      return NextResponse.json(
        { error: "Commande invalide." },
        { status: 400 }
      );
    }

    const order = await prisma.order.findUnique({
      where: {
        id: orderId,
      },
      include: {
        payment: true,
        campaign: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Commande introuvable." },
        { status: 404 }
      );
    }

    if (order.status === "CANCELLED") {
      return NextResponse.json(
        { error: "Cette commande est annulée." },
        { status: 400 }
      );
    }

    if (order.payment?.status === "PAID") {
      return NextResponse.json({
        success: true,
        message: "Cette commande est déjà payée.",
        paymentId: order.payment.id,
        orderId: order.id,
        amount: order.amount,
        status: "PAID",
      });
    }

    if (order.status === "CONFIRMED") {
      return NextResponse.json(
        {
          error: "Cette commande est déjà confirmée.",
        },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // PAIEMENT DE TEST
    // ---------------------------------------------------------
    if (provider === "TEST") {
      const result = await prisma.$transaction(async (tx) => {
        const payment = await tx.payment.upsert({
          where: {
            orderId,
          },
          update: {
            amount: order.amount,
            provider: "TEST",
            status: "PAID",
          },
          create: {
            orderId,
            amount: order.amount,
            provider: "TEST",
            status: "PAID",
          },
        });

        const updatedOrder = await tx.order.update({
          where: {
            id: orderId,
          },
          data: {
            status: "CONFIRMED",
          },
        });

        return {
          payment,
          order: updatedOrder,
        };
      });

      return NextResponse.json({
        success: true,
        message: "Paiement de test confirmé.",
        paymentId: result.payment.id,
        orderId: result.order.id,
        amount: result.order.amount,
        status: result.payment.status,
      });
    }

    // ---------------------------------------------------------
    // PAIEMENT PAYTECH
    // ---------------------------------------------------------
    if (provider !== "PAYTECH") {
      return NextResponse.json(
        {
          error: "Mode de paiement non disponible.",
        },
        { status: 400 }
      );
    }

    const apiKey = process.env.PAYTECH_API_KEY;
    const apiSecret = process.env.PAYTECH_API_SECRET;
    const environment = process.env.PAYTECH_ENV || "test";

    if (!apiKey || !apiSecret) {
      console.error("Variables PayTech manquantes.");

      return NextResponse.json(
        {
          error: "Le paiement PayTech n'est pas configuré.",
        },
        { status: 500 }
      );
    }

    /*
     * Comme nous ne stockons pas encore la référence PayTech
     * dans Payment, nous utilisons une référence déterministe
     * basée sur l'identifiant de la commande.
     *
     * Exemple : SAMA-ORDER-1
     */
    const refCommand = `SAMA-ORDER-${order.id}`;

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const paymentPayload = {
      item_name: order.campaign.product.name,
      item_price: order.amount,
      ref_command: refCommand,
      command_name: `Commande SamaAchat #${order.id}`,
      currency: "XOF",
      env: environment,

      ipn_url: `${baseUrl}/api/payments/ipn`,
      success_url: `${baseUrl}/confirmation?orderId=${order.id}&payment=success`,
      cancel_url: `${baseUrl}/confirmation?orderId=${order.id}&payment=cancelled`,

      custom_field: JSON.stringify({
        orderId: order.id,
        refCommand,
      }),
    };

    console.log("Création paiement PayTech :", {
      orderId: order.id,
      amount: order.amount,
      refCommand,
      environment,
    });

    const paytechResponse = await fetch(PAYTECH_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        API_KEY: apiKey,
        API_SECRET: apiSecret,
      },
      body: JSON.stringify(paymentPayload),
    });

    const paytechData = await paytechResponse.json();

    if (!paytechResponse.ok || !paytechData.success) {
      console.error("Erreur PayTech :", paytechData);

      return NextResponse.json(
        {
          error:
            paytechData.message ||
            "Impossible de créer le paiement PayTech.",
        },
        { status: 502 }
      );
    }

    // On crée seulement un paiement PENDING.
    // La confirmation réelle sera faite par l'IPN PayTech.
    const payment = await prisma.payment.upsert({
      where: {
        orderId: order.id,
      },
      update: {
        amount: order.amount,
        provider: "PAYTECH",
        status: "PENDING",
      },
      create: {
        orderId: order.id,
        amount: order.amount,
        provider: "PAYTECH",
        status: "PENDING",
      },
    });

    const redirectUrl =
  paytechData.redirect_url ?? paytechData.redirectUrl;

if (!redirectUrl) {
  console.error("Réponse PayTech sans URL de paiement :", paytechData);

  return NextResponse.json(
    {
      error:
        paytechData.message ??
        "PayTech n'a pas fourni de lien de paiement.",
    },
    { status: 502 }
  );
}

return NextResponse.json({
  success: true,
  paymentId: payment.id,
  orderId: order.id,
  amount: order.amount,
  status: "PENDING",
  redirectUrl,
  token: paytechData.token,
});
  } catch (error) {
    console.error("Erreur paiement :", error);

    return NextResponse.json(
      { error: "Une erreur est survenue." },
      { status: 500 }
    );
  }
}