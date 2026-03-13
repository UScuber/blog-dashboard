import { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import admin from "firebase-admin";

let firebaseInitialized = false;

function initFirebase() {
  if (firebaseInitialized) return;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase環境変数が設定されていません");
  }

  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }

  firebaseInitialized = true;
}

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new HTTPException(401, { message: "認証トークンがありません" });
  }

  const token = authHeader.slice(7);

  initFirebase();

  let decodedToken: admin.auth.DecodedIdToken;
  try {
    decodedToken = await admin.auth().verifyIdToken(token);
  } catch {
    throw new HTTPException(401, { message: "無効な認証トークンです" });
  }

  const email = decodedToken.email;
  if (!email) {
    throw new HTTPException(401, {
      message: "トークンにメールアドレスが含まれていません",
    });
  }

  const allowedEmails = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  if (!allowedEmails.includes(email)) {
    throw new HTTPException(403, { message: "アクセス権限がありません" });
  }

  c.set("userEmail", email);
  await next();
}
