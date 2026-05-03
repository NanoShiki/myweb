import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(moduleDir, "..", "..");
const blogRoot = path.join(repoRoot, "text", "Blog");
const blogArchiveRoot = path.join(blogRoot, "archive");
const thoughtRoot = path.join(repoRoot, "text", "Thought");

function resolveWithin(root: string, ...segments: string[]) {
  const resolved = path.resolve(root, ...segments);
  if (resolved === root || resolved.startsWith(`${root}${path.sep}`)) {
    return resolved;
  }
  return null;
}

function rewriteMarkdownAssetLinks(content: string, relativePath: string) {
  let baseAssetUrl = `/Blog/${relativePath}`;
  if (!baseAssetUrl.endsWith("/")) {
    baseAssetUrl += "/";
  }

  let rewritten = content.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, target) => {
    let url = target.trim();
    let title = "";
    const spaceIdx = target.indexOf(" ");

    if (spaceIdx !== -1 && (target.includes("\"") || target.includes("'"))) {
      const quoteMatch = target.match(/\s+['"]([^'"]+)['"]$/);
      if (quoteMatch) {
        url = target.slice(0, quoteMatch.index).trim();
        title = quoteMatch[0];
      }
    }

    let finalUrl = url;
    if (!url.startsWith("http") && !url.startsWith("#") && !url.startsWith("data:")) {
      if (url.startsWith("/")) {
        finalUrl = encodeURI(url);
      } else {
        finalUrl = encodeURI(baseAssetUrl + url);
      }
    }

    finalUrl = finalUrl.replace(/\(/g, "%28").replace(/\)/g, "%29");
    return `![${alt}](${finalUrl}${title})`;
  });

  rewritten = rewritten.replace(/<img[^>]+src="([^"]+)"[^>]*>/g, (match, url) => {
    if (url.startsWith("http") || url.startsWith("data:")) {
      return match;
    }

    const finalUrl = url.startsWith("/")
      ? encodeURI(url)
      : encodeURI(baseAssetUrl + url);

    return match.replace(url, finalUrl);
  });

  return rewritten;
}

export function readBlogConfig() {
  const configPath = path.join(blogRoot, "config.json");
  if (!fs.existsSync(configPath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

export function readBlogPost(postPath: string) {
  const relativePath = postPath.replace(/^\/Blog\//, "");
  const parts = relativePath.split("/").filter(Boolean);
  const folderName = parts[parts.length - 1];

  if (!folderName) {
    return null;
  }

  const markdownPath = resolveWithin(
    path.join(repoRoot, "text"),
    relativePath,
    `${folderName}.md`,
  );

  if (!markdownPath || !fs.existsSync(markdownPath)) {
    return null;
  }

  const content = fs.readFileSync(markdownPath, "utf-8");
  return rewriteMarkdownAssetLinks(content, relativePath);
}

export function listThoughts() {
  if (!fs.existsSync(thoughtRoot)) {
    return [];
  }

  return fs
    .readdirSync(thoughtRoot)
    .filter((file) => file.endsWith(".md"))
    .map((file) => {
      const fullPath = path.join(thoughtRoot, file);
      const content = fs.readFileSync(fullPath, "utf-8");
      const match = file.match(/^(\d{4}-\d{1,2}-\d{1,2}-\d{1,2}-\d{1,2})\.md$/);

      let isoDate = "";
      if (match) {
        const [y, m, d, h, min] = match[1].split("-").map((value) => value.padStart(2, "0"));
        isoDate = `${y}-${m}-${d}T${h}:${min}:00`;
      } else {
        isoDate = fs.statSync(fullPath).birthtime.toISOString();
      }

      return {
        filename: file,
        date: isoDate,
        content,
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function contentTypeFor(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".svg":
      return "image/svg+xml";
    case ".md":
      return "text/markdown; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

export function readBlogAsset(assetPath: string) {
  const resolved = resolveWithin(blogArchiveRoot, assetPath);
  if (!resolved || !fs.existsSync(resolved)) {
    return null;
  }

  return {
    body: fs.readFileSync(resolved),
    contentType: contentTypeFor(resolved),
  };
}

export function readThoughtAsset(assetPath: string) {
  const resolved = resolveWithin(thoughtRoot, assetPath);
  if (!resolved || !fs.existsSync(resolved)) {
    return null;
  }

  return {
    body: fs.readFileSync(resolved),
    contentType: contentTypeFor(resolved),
  };
}
