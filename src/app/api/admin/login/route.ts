import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createAdminSession, ADMIN_COOKIE } from "@/lib/admin-auth";
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
      where: { phone },
    });

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Identifiants incorrects." },
        { status: 401 }
      );
    }

    if (
  !user.password ||
  !(await bcrypt.compare(password, user.password))
) {
      return NextResponse.json(
        { error: "Identifiants incorrects." },
        { status: 401 }
      );
    }

    const sessionToken = createAdminSession(user.id);

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

    response.cookies.set(
      ADMIN_COOKIE.name,
      sessionToken,
      {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: ADMIN_COOKIE.maxAge,
      }
    );

    return response;
  } catch (error) {
    console.error("Admin login error:", error);

    return NextResponse.json(
      { error: "Erreur serveur." },
      { status: 500 }
    );
  }
}