interface CorsOptions {
  credentials: true;
  origin: string | string[];
}

export function parseFrontendOrigins(frontendOrigin: string): string[] {
  const origins = frontendOrigin.split(',').map((origin) => origin.trim());

  if (origins.length === 0 || origins.some((origin) => origin.length === 0)) {
    throw new Error('FRONTEND_ORIGIN must contain one or more origins');
  }

  return Array.from(new Set(origins));
}

export function createCorsOptions(frontendOrigin: string): CorsOptions {
  const origins = parseFrontendOrigins(frontendOrigin);

  return {
    origin: origins.length === 1 ? origins[0] : origins,
    credentials: true,
  };
}
