import { Context } from "hono";
import { HTTPException } from "hono/http-exception";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "content-length",
  "host",
]);
const AUTH_PROXY_PREFIX = "/api/firebase-auth/";

function removeHopByHopHeaders(headers: Headers): Headers {
  for (const key of HOP_BY_HOP_HEADERS) {
    headers.delete(key);
  }
  return headers;
}

function getHelperOrigin(): string {
  const raw = process.env.FIREBASE_AUTH_HELPER_ORIGIN;
  if (!raw) {
    throw new HTTPException(500, {
      message: "FIREBASE_AUTH_HELPER_ORIGIN が未設定です",
    });
  }

  const trimmed = raw.trim();
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const origin = new URL(withScheme).origin;
    return origin;
  } catch {
    throw new HTTPException(500, {
      message: "Firebase Auth helper origin の形式が不正です",
    });
  }
}

async function proxyToPath(c: Context, path: string): Promise<Response> {
  const method = c.req.method;
  const reqUrl = new URL(c.req.url);
  const targetUrl = new URL(path, getHelperOrigin());
  targetUrl.search = reqUrl.search;

  const headers = removeHopByHopHeaders(new Headers(c.req.raw.headers));
  const body =
    method === "GET" || method === "HEAD"
      ? undefined
      : await c.req.arrayBuffer();

  const upstream = await fetch(targetUrl.toString(), {
    method,
    headers,
    body,
    redirect: "follow",
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: removeHopByHopHeaders(new Headers(upstream.headers)),
  });
}

export async function proxyFirebaseAuthHelper(c: Context): Promise<Response> {
  const path = new URL(c.req.url).pathname;
  const helperPath = path.startsWith(AUTH_PROXY_PREFIX)
    ? path.slice(AUTH_PROXY_PREFIX.length)
    : "";
  return proxyToPath(c, `/__/auth/${helperPath}`);
}

export async function proxyFirebaseInit(c: Context): Promise<Response> {
  return proxyToPath(c, "/__/firebase/init.json");
}
