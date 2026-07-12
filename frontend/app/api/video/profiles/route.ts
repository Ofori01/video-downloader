import { NextRequest, NextResponse } from "next/server";
import { toRouteErrorResponse } from "@/lib/server/route-errors";
import { getAvailableProfilesForUrl } from "@/lib/server/video-profiles";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl.searchParams.get("url")?.trim();
    if (!url) {
      return NextResponse.json([], { status: 200 });
    }

    const profiles = await getAvailableProfilesForUrl(url);
    return NextResponse.json(profiles, { status: 200 });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
