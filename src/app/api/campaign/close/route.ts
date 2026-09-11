import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: "Cette action est réservée à l'administration.",
    },
    { status: 403 }
  );
}