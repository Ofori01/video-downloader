import { NextResponse } from "next/server";
import { toRouteErrorResponse } from "@/lib/server/route-errors";
import { getVideoFileStatus } from "@/lib/server/video-files";

type Params = {
  params: Promise<{ id: string }>;
};

export const runtime = "nodejs";

export async function GET(_: Request, context: Params) {
  try {
    const { id } = await context.params;
    const payload = await getVideoFileStatus(id);
    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
