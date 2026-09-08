import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const phone = String(body.phone ?? "").trim();
    const password = String(body.password ?? "");

    if (!phone || !password) {
      return NextResponse.json(
        { error: "Téléphone et mot de passe requis." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: {
        phone,
      },
    });

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Accès administrateur refusé." },
        { status: 403 }
      );
    }

    if (!user.password || user.password !== password) {
      return NextResponse.json(
        { error: "Mot de passe incorrect." },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      success: true,
      message: "Administrateur reconnu.",
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
      },
    });

    response.cookies.set("samaachat_admin", String(user.id), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    return response;
  } catch (error) {
    console.error("Erreur connexion admin :", error);

    return NextResponse.json(
      { error: "Une erreur est survenue." },
      { status: 500 }
    );
  }
}