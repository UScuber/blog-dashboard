import type { VercelRequest } from "@vercel/node";
import admin from "firebase-admin";

interface AuthResult {
  authenticated: boolean;
  email: string;
}

function getFirebaseAdmin(): admin.app.App {
  if (admin.apps.length > 0) {
    return admin.apps[0]!;
  }
  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

export async function verifyAuth(req: VercelRequest): Promise<AuthResult> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Authorization header missing");
  }

  const token = authHeader.slice(7);
  const app = getFirebaseAdmin();
  const decoded = await admin.auth(app).verifyIdToken(token);

  const email = decoded.email;
  if (!email) {
    throw new Error("Email not found in token");
  }

  const allowedEmails = (process.env.ALLOWED_EMAILS || "").split(",").map((e) => e.trim());
  if (!allowedEmails.includes(email)) {
    throw new Error("Forbidden: email not allowed");
  }

  return { authenticated: true, email };
}
