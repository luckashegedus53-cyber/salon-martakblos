import type { Express, Request, Response } from "express";

// OAuth route is disabled — app uses standalone username/password authentication.
// This file is kept for compatibility with server/_core/index.ts.
export function registerOAuthRoutes(app: Express) {
  // No-op: Manus OAuth callback is not used in standalone mode.
  // Login is handled via tRPC auth.login procedure with username + password.
}
