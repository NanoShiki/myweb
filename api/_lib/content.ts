import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const candidateRoots = Array.from(
  new Set(
    [
      process.env.LAMBDA_TASK_ROOT,
      process.cwd(),
      path.resolve(moduleDir, "..", ".."),
      path.resolve(moduleDir, "..", "..", "..", ".."),
    ].filter((value): value is string => Boolean(value)),
  ),
);

const repoRoot =
  candidateRoots.find(
    (root) =>
      fs.existsSync(path.join(root, "text", "Blog")) ||
      fs.existsSync(path.join(root, "text", "Thought")),
  ) ??
  path.resolve(moduleDir, "..", "..");
const blogRoot = path.join(repoRoot, "text", "Blog");
const blogArchiveRoot = path.join(blogRoot, "archive");
const thoughtRoot = path.join(repoRoot, "text", "Thought");

interface BlogPost {
  id: string;
  title: string;
  date: string;
  createdTs: number;
  path: string;
  categories: string[];
}

interface CategoryTreeNode {
  name: string;
  type: "category";
  children: CategoryTreeNode[];
  posts: BlogPost[];
}

const defaultBlogSite = {
  title: "如珩的博客",
  subtitle: "技术笔记与分享",
  author: "如珩",
};

const ignoredBlogDirs = new Set(["assets", ".obsidian", ".git", "node_modules"]);
const naturalCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

function decodePath(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function resolveWithin(root: string, ...segments: string[]) {
  const resolved = path.resolve(root, ...segments);
  if (resolved === root || resolved.startsWith(`${root}${path.sep}`)) {
    return resolved;
  }
  return null;
}

function normalizeUrlPath(value: string) {
  return decodePath(value)
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^Blog\//, "")
    .replace(/\/+$/, "");
}

function pathToUrlPath(value: string) {
  return value.split(path.sep).join("/");
}

function encodeUrlPath(value: string) {
  const suffixIndex = value.search(/[?#]/);
  const pathname = suffixIndex === -1 ? value : value.slice(0, suffixIndex);
  const suffix = suffixIndex === -1 ? "" : value.slice(suffixIndex);

  return `${pathname
    .split("/")
    .map((segment) => {
      try {
        return encodeURIComponent(decodeURIComponent(segment));
      } catch {
        return encodeURIComponent(segment);
      }
    })
    .join("/")}${suffix}`;
}

function isIgnoredBlogDir(name: string) {
  return ignoredBlogDirs.has(name) || name.startsWith(".");
}

function naturalCompare(a: string, b: string) {
  return naturalCollator.compare(a, b);
}

function formatLocalDate(timestampMs: number) {
  const date = new Date(timestampMs);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getOrderedSubdirs(dir: string) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !isIgnoredBlogDir(entry.name))
    .sort((a, b) => naturalCompare(a.name, b.name));
}

function findPostMarkdownInDir(dir: string) {
  const folderName = path.basename(dir);
  const preferredPath = path.join(dir, `${folderName}.md`);
  if (fs.existsSync(preferredPath)) {
    return preferredPath;
  }

  const markdownFiles = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
    .map((entry) => entry.name)
    .sort((a, b) => naturalCompare(a, b));

  return markdownFiles.length === 1 ? path.join(dir, markdownFiles[0]) : null;
}

function hasBlogPosts(root: string, skipArchive: boolean) {
  const walk = (dir: string, isRoot = false): boolean => {
    if (!fs.existsSync(dir)) {
      return false;
    }

    if (!isRoot && findPostMarkdownInDir(dir)) {
      return true;
    }

    return getOrderedSubdirs(dir).some((entry) => {
      if (isRoot && skipArchive && entry.name === "archive") {
        return false;
      }
      return walk(path.join(dir, entry.name));
    });
  };

  return walk(root, true);
}

function extractTitleFromMarkdown(markdownPath: string) {
  const content = fs.readFileSync(markdownPath, "utf-8");
  const titleLine = content
    .split(/\r?\n/)
    .find((line) => /^#\s+/.test(line.trim()));

  return titleLine?.trim().replace(/^#\s+/, "").trim() || path.basename(markdownPath, ".md");
}

function getBlogContentRoot() {
  if (hasBlogPosts(blogRoot, true)) {
    return {
      fsRoot: blogRoot,
      urlPrefix: "/Blog",
      skipArchive: true,
    };
  }

  if (hasBlogPosts(blogArchiveRoot, false)) {
    return {
      fsRoot: blogArchiveRoot,
      urlPrefix: "/Blog/archive",
      skipArchive: false,
    };
  }

  return {
    fsRoot: blogRoot,
    urlPrefix: "/Blog",
    skipArchive: true,
  };
}

function buildBlogPost(urlPrefix: string, relPathParts: string[], dir: string) {
  const markdownPath = findPostMarkdownInDir(dir);
  if (!markdownPath) {
    return null;
  }

  const markdownStats = fs.statSync(markdownPath);
  const timestampMs = markdownStats.mtimeMs || markdownStats.birthtimeMs || Date.now();
  const relPath = relPathParts.join("/");

  return {
    id: relPathParts.join("_"),
    title: extractTitleFromMarkdown(markdownPath),
    date: formatLocalDate(timestampMs),
    createdTs: Math.floor(timestampMs / 1000),
    path: `${urlPrefix}/${relPath}/`,
    categories: relPathParts.slice(0, -1),
  } satisfies BlogPost;
}

function findBlogPostsRecursive(urlPrefix: string, currentDir: string, relPathParts: string[], skipArchive: boolean) {
  const posts: BlogPost[] = [];

  for (const entry of getOrderedSubdirs(currentDir)) {
    if (relPathParts.length === 0 && skipArchive && entry.name === "archive") {
      continue;
    }

    const entryPath = path.join(currentDir, entry.name);
    const nextRelPathParts = [...relPathParts, entry.name];
    const post = buildBlogPost(urlPrefix, nextRelPathParts, entryPath);

    if (post) {
      posts.push(post);
    } else {
      posts.push(
        ...findBlogPostsRecursive(urlPrefix, entryPath, nextRelPathParts, skipArchive),
      );
    }
  }

  return posts;
}

function getPostFolderName(post: BlogPost) {
  return post.path.replace(/\/+$/, "").split("/").pop() ?? "";
}

function sortPosts(posts: BlogPost[]) {
  return posts.sort((a, b) => {
    const createdDiff = b.createdTs - a.createdTs;
    if (createdDiff !== 0) {
      return createdDiff;
    }

    const folderDiff = naturalCompare(getPostFolderName(b), getPostFolderName(a));
    if (folderDiff !== 0) {
      return folderDiff;
    }

    return b.path.localeCompare(a.path);
  });
}

function buildCategoryTree(posts: BlogPost[]) {
  const tree: CategoryTreeNode = {
    name: "root",
    type: "category",
    children: [],
    posts: [],
  };
  const categoryMap = new Map<string, CategoryTreeNode>();

  for (const post of posts) {
    let current = tree;
    const categoryPath = ["root"];

    for (const category of post.categories) {
      categoryPath.push(category);
      const pathKey = categoryPath.join("/");
      let node = categoryMap.get(pathKey);

      if (!node) {
        node = {
          name: category,
          type: "category",
          children: [],
          posts: [],
        };
        categoryMap.set(pathKey, node);
        current.children.push(node);
      }

      current = node;
    }

    current.posts.push(post);
  }

  for (const node of categoryMap.values()) {
    sortPosts(node.posts);
    node.children.sort((a, b) => naturalCompare(a.name, b.name));
  }

  tree.children.sort((a, b) => naturalCompare(a.name, b.name));
  return tree;
}

function getBlogRelativeCandidates(value: string) {
  const relativePath = normalizeUrlPath(value);
  const candidates = [relativePath];

  if (relativePath.startsWith("archive/")) {
    candidates.push(relativePath.replace(/^archive\//, ""));
  } else if (relativePath) {
    candidates.push(`archive/${relativePath}`);
  }

  return Array.from(new Set(candidates.filter(Boolean)));
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
        finalUrl = encodeUrlPath(url);
      } else {
        finalUrl = encodeUrlPath(baseAssetUrl + url);
      }
    }

    return `![${alt}](${finalUrl}${title})`;
  });

  rewritten = rewritten.replace(/<img[^>]+src="([^"]+)"[^>]*>/g, (match, url) => {
    if (url.startsWith("http") || url.startsWith("data:")) {
      return match;
    }

    const finalUrl = url.startsWith("/")
      ? encodeUrlPath(url)
      : encodeUrlPath(baseAssetUrl + url);

    return match.replace(url, finalUrl);
  });

  return rewritten;
}

export function readBlogConfig() {
  if (!fs.existsSync(blogRoot)) {
    return null;
  }

  const configPath = path.join(blogRoot, "config.json");
  const existingConfig = fs.existsSync(configPath)
    ? JSON.parse(fs.readFileSync(configPath, "utf-8"))
    : null;
  const { fsRoot, urlPrefix, skipArchive } = getBlogContentRoot();
  const posts = sortPosts(findBlogPostsRecursive(urlPrefix, fsRoot, [], skipArchive));

  if (posts.length === 0 && existingConfig) {
    return existingConfig;
  }

  return {
    site: existingConfig?.site ?? defaultBlogSite,
    posts,
    categoryTree: buildCategoryTree(posts),
  };
}

export function readBlogPost(postPath: string) {
  for (const relativePath of getBlogRelativeCandidates(postPath)) {
    const postDir = resolveWithin(blogRoot, relativePath);

    if (!postDir || !fs.existsSync(postDir) || !fs.statSync(postDir).isDirectory()) {
      continue;
    }

    const markdownPath = findPostMarkdownInDir(postDir);
    if (markdownPath) {
      const content = fs.readFileSync(markdownPath, "utf-8");
      return rewriteMarkdownAssetLinks(content, pathToUrlPath(path.relative(blogRoot, postDir)));
    }
  }

  return null;
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
  for (const relativePath of getBlogRelativeCandidates(assetPath)) {
    const resolved = resolveWithin(blogRoot, relativePath);

    if (resolved && fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
      return {
        body: fs.readFileSync(resolved),
        contentType: contentTypeFor(resolved),
      };
    }
  }

  return null;
}

export function readThoughtAsset(assetPath: string) {
  const resolved = resolveWithin(thoughtRoot, decodePath(assetPath));
  if (!resolved || !fs.existsSync(resolved)) {
    return null;
  }

  return {
    body: fs.readFileSync(resolved),
    contentType: contentTypeFor(resolved),
  };
}
