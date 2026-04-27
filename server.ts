import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Serve Blog files
  app.get("/api/blog/config", (req, res) => {
    const configPath = path.join(process.cwd(), "text/Blog/config.json");
    if (fs.existsSync(configPath)) {
      res.json(JSON.parse(fs.readFileSync(configPath, "utf-8")));
    } else {
      res.status(404).json({ error: "Blog config not found" });
    }
  });

  app.get("/api/blog/post", (req, res) => {
    const postPath = req.query.path as string; // e.g., /Blog/archive/UE/Lyra/Lyra角色系统入门/
    if (!postPath) return res.status(400).json({ error: "Missing path" });
    
    // Clean up the path and read the markdown file
    // postPath is something like /Blog/archive/.../
    // We want to map it to /text/Blog/archive/.../
    // The markdown file usually has the same name as the folder
    const relativePath = postPath.replace(/^\/Blog\//, "");
    const parts = relativePath.split('/').filter(Boolean);
    const folderName = parts[parts.length - 1]; // "Lyra角色系统入门"
    
    const mdPath = path.join(process.cwd(), "text", "Blog", relativePath, `${folderName}.md`);
    if (fs.existsSync(mdPath)) {
      let content = fs.readFileSync(mdPath, "utf-8");
      // Markdown image links can be ![alt](assets/img.png) or ![alt](/Blog/assets/img.png "title")
      // We need to rewrite relative paths to point to correct API and encode spaces so markdown parsers don't fail
      let baseAssetUrl = `/Blog/${relativePath}`;
      if (!baseAssetUrl.endsWith('/')) {
         baseAssetUrl += '/';
      }
      content = content.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, target) => {
        let url = target.trim();
        let title = '';
        const spaceIdx = target.indexOf(' ');
        if (spaceIdx !== -1 && (target.includes('"') || target.includes('\''))) {
          const quoteMatch = target.match(/\s+['"]([^'"]+)['"]$/);
          if (quoteMatch) {
            url = target.slice(0, quoteMatch.index).trim();
            title = quoteMatch[0];
          }
        }
        let finalUrl = url;
        if (!url.startsWith('http') && !url.startsWith('#') && !url.startsWith('data:')) {
          if (url.startsWith('/')) {
            finalUrl = encodeURI(url);
          } else {
            finalUrl = encodeURI(baseAssetUrl + url);
          }
        }
        // Encode parenthesis in URL because markdown chokes on them
        finalUrl = finalUrl.replace(/\(/g, '%28').replace(/\)/g, '%29');
        let finalTitle = title ? title : '';
        return `![${alt}](${finalUrl}${finalTitle})`;
      });

      // Handle raw <img src="..."> tags safely
      content = content.replace(/<img[^>]+src="([^"]+)"[^>]*>/g, (match, url) => {
        if (!url.startsWith('http') && !url.startsWith('data:')) {
          let finalUrl = url;
          if (url.startsWith('/')) {
            finalUrl = encodeURI(url);
          } else {
            finalUrl = encodeURI(baseAssetUrl + url);
          }
          return match.replace(url, finalUrl);
        }
        return match;
      });
      res.send(content);
    } else {
      res.status(404).send("Markdown file not found");
    }
  });

  // Serve Blog assets
  // Usually /Blog/archive/.../assets/image.png
  app.use("/Blog/archive", express.static(path.join(process.cwd(), "text/Blog/archive")));
  app.use("/Thought", express.static(path.join(process.cwd(), "text/Thought")));

  // API for thoughts
  app.get("/api/thoughts", (req, res) => {
    const thoughtDir = path.join(process.cwd(), "text/Thought");
    if (!fs.existsSync(thoughtDir)) {
      return res.json([]);
    }
    const files = fs.readdirSync(thoughtDir);
    const thoughts = files
      .filter((f) => f.endsWith(".md"))
      .map((f) => {
        const content = fs.readFileSync(path.join(thoughtDir, f), "utf-8");
        // extract YYYY-MM-DD-HH-MM
        const match = f.match(/^(\d{4}-\d{1,2}-\d{1,2}-\d{1,2}-\d{1,2})\.md$/);
        const dateStr = match ? match[1] : null;
        let date = new Date(0);
        if (dateStr) {
          const [y, m, d, h, min] = dateStr.split("-").map(Number);
          date = new Date(y, m - 1, d, h, min);
        } else {
          // fallback to stats
          date = fs.statSync(path.join(thoughtDir, f)).birthtime;
        }
        return {
          filename: f,
          date: date.toISOString(),
          content: content,
        };
      });
    
    // sort descending by date
    thoughts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    res.json(thoughts);
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
