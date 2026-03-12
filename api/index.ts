import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { handle } from "@hono/node-server/vercel";
import { authMiddleware } from "./middleware/auth";
import articles from "./routes/articles";
import create from "./routes/create";
import publish from "./routes/publish";
import deployments from "./routes/deployments";
import proxyImage from "./routes/proxy-image";

const app = new Hono().basePath("/api");

// 画像プロキシ（認証不要）
app.route("/proxy-image", proxyImage);

// 認証ミドルウェア（画像プロキシ以外の各ルートに個別適用）
app.use("/articles/*", authMiddleware);
app.use("/create/*", authMiddleware);
app.use("/publish/*", authMiddleware);
app.use("/deployments/*", authMiddleware);

// 認証が必要なルート
app.route("/articles", articles);
app.route("/create", create);
app.route("/publish", publish);
app.route("/deployments", deployments);

// エラーハンドリング
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }

  // Octokit errors
  if ("status" in err && typeof (err as any).status === "number") {
    const status = (err as any).status;
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
