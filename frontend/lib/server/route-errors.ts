import { NextResponse } from "next/server";

type RouteErrorPayload = {
  statusCode: number;
  message: string;
  error: string;
};

function isRouteErrorPayload(value: unknown): value is RouteErrorPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    "statusCode" in value &&
    typeof (value as { statusCode?: unknown }).statusCode === "number" &&
    "message" in value &&
    typeof (value as { message?: unknown }).message === "string" &&
    "error" in value &&
    typeof (value as { error?: unknown }).error === "string"
  );
}

export function toRouteErrorResponse(error: unknown): NextResponse {
  const payload: RouteErrorPayload = isRouteErrorPayload(error)
    ? error
    : {
        statusCode: 500,
        message: "Internal Server Error",
        error: "Internal Server Error",
      };

  return NextResponse.json(payload, {
    status: payload.statusCode,
  });
}
