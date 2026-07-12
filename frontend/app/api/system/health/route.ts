import { NextResponse } from "next/server";
import { getSystemHealthStatus } from "@/lib/server/health-check";

export const runtime = "nodejs";

export async function GET() {
  const payload = await getSystemHealthStatus();
  return NextResponse.json(payload, { status: 200 });
}
