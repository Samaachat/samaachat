import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const PAYTECH_API_URL =
  "https://paytech.sn/api/payment/request-payment";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const orderId = Number(body.orderId);
    const provider = String(body.provider ?? "TEST")
      .trim()
      .toUpperCase();

    // ---------------------------------------------------------
    // 1. Vérification de la commande
    // ---------------------------------------------------------

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
    // 2. PAIEMENT TEST SAMAACHAT
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
    // 3. VÉRIFICATION DU PROVIDER
    // ---------------------------------------------------------

    if (provider !== "PAYTECH") {
      return NextResponse.json(
        {
          error: "Mode de paiement non disponible.",
        },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // 4. VARIABLES PAYTECH
    // ---------------------------------------------------------

    const apiKey = process.env.PAYTECH_API_KEY;
    const apiSecret = process.env.PAYTECH_API_SECRET;
    const environment = process.env.PAYTECH_ENV || "test";
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!apiKey || !apiSecret) {
      console.error("Variables PayTech manquantes.");

      return NextResponse.json(
        {
          error: "Le paiement PayTech n'est pas configuré.",
        },
        { status: 500 }
      );
    }

    if (!baseUrl) {
      console.error("NEXT_PUBLIC_APP_URL manquante.");

      return NextResponse.json(
        {
          error: "L'URL du site n'est pas configurée.",
        },
        { status: 500 }
      );
    }

    // ---------------------------------------------------------
    // 5. RÉFÉRENCE UNIQUE PAYTECH
    // ---------------------------------------------------------

    const refCommand = `SAMA-ORDER-${order.id}`;

    // ---------------------------------------------------------
    // 6. DONNÉES ENVOYÉES À PAYTECH
    // ---------------------------------------------------------

    const paymentPayload = {
      item_name: order.campaign.product.name,
      item_price: order.amount,
      currency: "XOF",
      ref_command: refCommand,
      command_name: `Commande SamaAchat #${order.id}`,
      env: environment,

      ipn_url: `${baseUrl}/api/payments/ipn`,

      success_url:
        `${baseUrl}/confirmation?orderId=${order.id}&payment=success`,

      cancel_url:
        `${baseUrl}/confirmation?orderId=${order.id}&payment=cancelled`,

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
      ipnUrl: paymentPayload.ipn_url,
    });

    // ---------------------------------------------------------
    // 7. APPEL SERVEUR PAYTECH
    // ---------------------------------------------------------

    const paytechResponse = await fetch(PAYTECH_API_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        API_KEY: apiKey,
        API_SECRET: apiSecret,
      },
      body: JSON.stringify(paymentPayload),
    });

    const responseText = await paytechResponse.text();

    console.log("Réponse HTTP PayTech :", {
      status: paytechResponse.status,
      body: responseText,
    });

    let paytechData: Record<string, unknown>;

    try {
      paytechData = JSON.parse(responseText);
    } catch {
      console.error(
        "PayTech a retourné une réponse non JSON :",
        responseText
      );

      return NextResponse.json(
        {
          error: "Réponse invalide de PayTech.",
        },
        { status: 502 }
      );
    }

    // ---------------------------------------------------------
    // 8. VÉRIFICATION DE LA RÉPONSE PAYTECH
    // ---------------------------------------------------------

    const paytechSuccess =
      paytechData.success === 1 ||
      paytechData.success === "1" ||
      paytechData.success === true;

    if (!paytechResponse.ok || !paytechSuccess) {
      console.error("PayTech a refusé le paiement :", paytechData);

      const message =
        typeof paytechData.message === "string"
          ? paytechData.message
          : typeof paytechData.error === "string"
            ? paytechData.error
            : "Impossible de créer le paiement PayTech.";

      return NextResponse.json(
        {
          error: message,
        },
        { status: 502 }
      );
    }

    // ---------------------------------------------------------
    // 9. RÉCUPÉRATION DU LIEN PAYTECH
    // ---------------------------------------------------------

    const redirectUrl =
      typeof paytechData.redirect_url === "string"
        ? paytechData.redirect_url
        : typeof paytechData.redirectUrl === "string"
          ? paytechData.redirectUrl
          : "";

    const token =
      typeof paytechData.token === "string"
        ? paytechData.token
        : "";

    if (!redirectUrl) {
      console.error(
        "PayTech a accepté la demande mais aucun lien n'a été retourné :",
        paytechData
      );

      return NextResponse.json(
        {
          error:
            "PayTech a accepté la demande mais n'a pas fourni de lien de paiement.",
        },
        { status: 502 }
      );
    }

    // ---------------------------------------------------------
    // 10. ENREGISTREMENT DU PAIEMENT EN ATTENTE
    // ---------------------------------------------------------

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

    // ---------------------------------------------------------
    // 11. RÉPONSE À SAMAACHAT
    // ---------------------------------------------------------

    return NextResponse.json({
      success: true,
      paymentId: payment.id,
      orderId: order.id,
      amount: order.amount,
      status: "PENDING",
      redirectUrl,
      token,
    });
  } catch (error) {
    console.error("Erreur paiement :", error);

    return NextResponse.json(
      {
        error: "Une erreur est survenue.",
      },
      { status: 500 }
    );
  }
}