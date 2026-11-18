import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      issuer: process.env.AUTH_ISSUER || "https://auth.mercantec.tech",
      clientId: process.env.AUTH_CLIENT_ID || "",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
