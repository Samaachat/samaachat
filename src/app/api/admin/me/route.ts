import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const cookieHeader = request.headers.get("cookie");

    const match = cookieHeader?.match(/(?:^|;\s*)samaachat_admin=([^;]+)/);
    const adminId = match?.[1];

    if (!adminId) {
      return NextResponse.json(
        { authenticated: false },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: {
        id: Number(adminId),
      },
    });

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { authenticated: false },
        { status: 401 }
      );
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Erreur vérification admin :", error);

    return NextResponse.json(
      { authenticated: false },
      { status: 500 }
    );
  }
}