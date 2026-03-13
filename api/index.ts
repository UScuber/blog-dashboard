import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { RequestError } from "@octokit/request-error";
import { handle } from "@hono/node-server/vercel";
import { authMiddleware } from "../server/middleware/auth";
import listArticles from "../server/handlers/list-articles";
import getArticle from "../server/handlers/get-article";
import updateArticle from "../server/handlers/update-article";
import createArticle from "../server/handlers/create-article";
import publishArticle from "../server/handlers/publish-article";
import getDeployments from "../server/handlers/get-deployments";
import proxyImage from "../server/handlers/proxy-image";

const app = new Hono<{ Variables: { userEmail: string } }>().basePath("/api");

app.use("/*", authMiddleware);

// ルート定義
app.get("/auth/check", (c) => {
  return c.json({ ok: true });
});
app.get("/proxy-image", proxyImage);
app.get("/articles", listArticles);
app.get("/articles/:id", getArticle);
app.post("/articles/:id", updateArticle);
app.post("/create", createArticle);
app.post("/publish", publishArticle);
app.get("/deployments", getDeployments);

// エラーハンドリング
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }

  if (err instanceof RequestError) {
    const status = err.status;
    if (status === 404) {
      return c.json({ error: "リソースが見つかりません" }, 404);
    }
    if (status === 422) {
      return c.json({ error: "処理できないリクエストです" }, 422);
    }
  }

  console.error("Unhandled error:", err);
  return c.json({ error: err.message || "内部サーバーエラー" }, 500);
});

// vercel dev は body をパース済みにするが rawBody を設定しないため補完する
const listener = handle(app);
export default (
  req: import("http").IncomingMessage & { body?: unknown; rawBody?: Buffer },
  res: import("http").ServerResponse,
) => {
  if (!req.rawBody && req.body) {
    req.rawBody = Buffer.from(JSON.stringify(req.body));
  }
  return listener(req, res);
};
