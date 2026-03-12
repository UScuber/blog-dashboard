import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { RequestError } from "@octokit/request-error";
import { handle } from "@hono/node-server/vercel";
import { authMiddleware } from "./middleware/auth";
import listArticles from "./handlers/list-articles";
import getArticle from "./handlers/get-article";
import updateArticle from "./handlers/update-article";
import createArticle from "./handlers/create-article";
import publishArticle from "./handlers/publish-article";
import getDeployments from "./handlers/get-deployments";
import proxyImage from "./handlers/proxy-image";

const app = new Hono().basePath("/api");

app.use("/*", authMiddleware);

// ルート定義
app.get("/proxy-image", proxyImage);
app.get("/articles", listArticles);
app.get("/articles/:id", getArticle);
app.put("/articles/:id", updateArticle);
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

export default handle(app);
