import { getAdminFromRequest } from "@/lib/admin-auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const user = await getAdminFromRequest(request);

    if (!user) {
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
    console.error("Admin auth error:", error);

    return NextResponse.json(
      { error: "Erreur serveur." },
      { status: 500 }
    );
  }
}