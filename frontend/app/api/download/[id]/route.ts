import { NextResponse } from "next/server";
import { toRouteErrorResponse } from "@/lib/server/route-errors";
import { getVideoDownloadRedirectUrl } from "@/lib/server/video-files";

type Params = {
  params: Promise<{ id: string }>;
};

export const runtime = "nodejs";

export async function GET(_: Request, context: Params) {
  try {
    const { id } = await context.params;
    const signedUrl = await getVideoDownloadRedirectUrl(id);
    return NextResponse.redirect(signedUrl, { status: 302 });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
