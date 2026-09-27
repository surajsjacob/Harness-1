import express from "express";
import path from "path";
import fs from "fs";
import { createHarnessApi } from "./harness-api";

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use((req, res, next) => {
  const t = Date.now();
  res.on("finish", () => { if (req.path.startsWith("/api")) console.log(req.method, req.path, res.statusCode, Date.now() - t + "ms"); });
  next();
});

app.use("/api", createHarnessApi());

const isProd = process.env.NODE_ENV === "production";
const dist = path.resolve("dist");
if (isProd && fs.existsSync(path.join(dist, "index.html"))) {
  app.use(express.static(dist));
  app.use((_req, res) => res.sendFile(path.join(dist, "index.html")));
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({ server: { middlewareMode: true }, appType: "spa" });
  app.use(vite.middlewares);
}

const port = Number(process.env.PORT) || 3000;
app.listen(port, "0.0.0.0", () => console.log(`Harness running on port ${port} (${isProd ? "production" : "development"})`));
