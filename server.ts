import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import {
  listThoughts,
  readBlogAsset,
  readBlogConfig,
  readBlogPost,
  readThoughtAsset,
} from "./api/_lib/content.js";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/blog/config", (req, res) => {
    const config = readBlogConfig();

    if (!config) {
      res.status(404).json({ error: "Blog config not found" });
      return;
    }

    res.json(config);
  });

  app.get("/api/blog/post", (req, res) => {
    const postPath = req.query.path as string;
    if (!postPath) return res.status(400).json({ error: "Missing path" });

    const content = readBlogPost(postPath);
    if (!content) {
      res.status(404).send("Markdown file not found");
      return;
    }

    res.type("text/plain; charset=utf-8").send(content);
  });

  app.get("/Blog/*", (req, res) => {
    const asset = readBlogAsset(req.params[0]);
    if (!asset) {
      res.status(404).send("Asset not found");
      return;
    }

    res.type(asset.contentType).send(asset.body);
  });

  app.get("/Thought/*", (req, res) => {
    const asset = readThoughtAsset(req.params[0]);
    if (!asset) {
      res.status(404).send("Asset not found");
      return;
    }

    res.type(asset.contentType).send(asset.body);
  });

  app.get("/api/thoughts", (req, res) => {
    res.json(listThoughts());
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
