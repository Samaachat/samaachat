import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const ADMIN_COOKIE_NAME = "samaachat_admin";
const SESSION_DURATION_SECONDS = 60 * 60 * 8;

function getSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!secret) {
    throw new Error(
      "ADMIN_SESSION_SECRET est manquante."
    );
  }

  return secret;
}

export function createAdminSession(userId: number) {
  const timestamp = Date.now().toString();

  const payload = `${userId}.${timestamp}`;

  const signature = crypto
    .createHmac("sha256", getSecret())
    .update(payload)
    .digest("hex");

  return `${payload}.${signature}`;
}

export async function getAdminFromRequest(
  request: Request
) {
  const cookieHeader =
    request.headers.get("cookie") ?? "";

  const match = cookieHeader.match(
    new RegExp(
      `(?:^|;\\s*)${ADMIN_COOKIE_NAME}=([^;]+)`
    )
  );

  const token = match?.[1];

  if (!token) {
    return null;
  }

  const parts = token.split(".");

  if (parts.length !== 3) {
    return null;
  }

  const [userIdText, timestampText, receivedSignature] =
    parts;

  const userId = Number(userIdText);
  const timestamp = Number(timestampText);

  if (
    !Number.isInteger(userId) ||
    userId < 1 ||
    !Number.isFinite(timestamp)
  ) {
    return null;
  }

  const ageSeconds =
    (Date.now() - timestamp) / 1000;

  if (
    ageSeconds < 0 ||
    ageSeconds > SESSION_DURATION_SECONDS
  ) {
    return null;
  }

  const payload = `${userId}.${timestamp}`;

  const expectedSignature = crypto
    .createHmac("sha256", getSecret())
    .update(payload)
    .digest("hex");

  if (
    receivedSignature.length !==
    expectedSignature.length
  ) {
    return null;
  }

  const validSignature =
    crypto.timingSafeEqual(
      Buffer.from(
        receivedSignature,
        "utf8"
      ),
      Buffer.from(
        expectedSignature,
        "utf8"
      )
    );

  if (!validSignature) {
    return null;
  }

  const user =
    await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

  if (!user || user.role !== "ADMIN") {
    return null;
  }

  return user;
}

export const ADMIN_COOKIE = {
  name: ADMIN_COOKIE_NAME,
  maxAge: SESSION_DURATION_SECONDS,
};