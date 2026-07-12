import { NextRequest, NextResponse } from "next/server";
import { toRouteErrorResponse } from "@/lib/server/route-errors";
import { submitVideoDownloadJob } from "@/lib/server/video-jobs";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { url?: string; profileId?: string };
    const result = await submitVideoDownloadJob({
      url: body.url ?? "",
      profileId: body.profileId,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
