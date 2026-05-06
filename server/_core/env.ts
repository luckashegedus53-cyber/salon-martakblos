export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "fallback-secret-change-in-production",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  // Legacy fields kept for compatibility (not used in standalone mode)
  appId: process.env.VITE_APP_ID ?? "local",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
