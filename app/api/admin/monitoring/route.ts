import { NextResponse } from "next/server";
import { getAdminUser } from "@/server/auth/authorization";
import { apiError } from "@/server/http/responses";
import { getSystemMetrics } from "@/server/monitoring/metrics";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) return apiError("Требуются права администратора", 403);
  return NextResponse.json({ metrics: await getSystemMetrics() });
}
