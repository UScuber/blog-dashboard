import type { VercelRequest } from "@vercel/node";

interface AuthResult {
  authenticated: boolean;
  email: string;
}

// TODO: Phase 3 で Firebase Admin SDK による ID Token 検証に置き替え
export async function verifyAuth(req: VercelRequest): Promise<AuthResult> {
  return { authenticated: true, email: "dev@example.com" };
}
