import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const textRoot = path.join(repoRoot, "text");
const blogRoot = path.join(textRoot, "Blog");
const blogArchiveRoot = path.join(blogRoot, "archive");
const thoughtRoot = path.join(textRoot, "Thought");
const configPath = path.join(textRoot, "config.json");
const legacyBlogConfigPath = path.join(blogRoot, "config.json");

const defaultSite = {
  title: "如珩的博客",
  subtitle: "技术笔记与分享",
  author: "如珩",
};

const ignoredDirs = new Set(["assets", ".obsidian", ".git", "node_modules"]);
const naturalCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

function naturalCompare(a, b) {
  return naturalCollator.compare(a, b);
}

function getCreatedTimestampMs(stats) {
  return stats.birthtimeMs || stats.mtimeMs || Date.now();
}

function formatLocalDate(timestampMs) {
  const date = new Date(timestampMs);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function decodePath(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeBlogPath(value) {
  return decodePath(String(value ?? ""))
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^Blog\//, "")
    .replace(/^archive\//, "")
    .replace(/\/+$/, "");
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function readHistoricalConfigFromGit() {
  const paths = ["text/config.json", "text/Blog/config.json"];

  try {
    const commits = execFileSync(
      "git",
      ["log", "--all", "--format=%H", "--", ...paths],
      { cwd: repoRoot, encoding: "utf-8" },
    )
      .trim()
      .split(/\r?\n/)
      .filter(Boolean);

    for (const commit of commits) {
      for (const filePath of paths) {
        for (const revision of [`${commit}:${filePath}`, `${commit}^:${filePath}`]) {
          try {
            return JSON.parse(
              execFileSync("git", ["show", revision], {
                cwd: repoRoot,
                encoding: "utf-8",
                stdio: ["ignore", "pipe", "ignore"],
              }),
            );
          } catch {
            // Try the next historical location.
          }
        }
      }
    }
  } catch {
    return null;
  }

  return null;
}

function readExistingConfig() {
  return readJsonIfExists(configPath) ??
    readJsonIfExists(legacyBlogConfigPath) ??
    readHistoricalConfigFromGit() ??
    {};
}

function isIgnoredDir(name) {
  return ignoredDirs.has(name) || name.startsWith(".");
}

function getOrderedSubdirs(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !isIgnoredDir(entry.name))
    .sort((a, b) => naturalCompare(a.name, b.name));
}

function getOrderedMarkdownFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
    .map((entry) => entry.name)
    .sort((a, b) => naturalCompare(a, b));
}

function findFolderPostMarkdownInDir(dir) {
  const folderName = path.basename(dir);
  const preferredPath = path.join(dir, `${folderName}.md`);
  return fs.existsSync(preferredPath) ? preferredPath : null;
}

function hasBlogPosts(root, skipArchive) {
  const walk = (dir, isRoot = false) => {
    if (!fs.existsSync(dir)) {
      return false;
    }

    if (!isRoot && findFolderPostMarkdownInDir(dir)) {
      return true;
    }

    if (getOrderedMarkdownFiles(dir).length > 0) {
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

function buildExistingPostLookup(posts = []) {
  const lookup = new Map();

  for (const post of posts) {
    if (post.id) {
      lookup.set(`id:${post.id}`, post);
    }

    const normalizedPath = normalizeBlogPath(post.path);
    if (normalizedPath) {
      lookup.set(`path:${normalizedPath}`, post);
    }

    if (post.title && Array.isArray(post.categories)) {
      lookup.set(`title:${[...post.categories, post.title].join("/")}`, post);
    }
  }

  return lookup;
}

function findExistingPost(lookup, post) {
  return (
    lookup.get(`id:${post.id}`) ??
    lookup.get(`path:${normalizeBlogPath(post.path)}`) ??
    lookup.get(`title:${[...post.categories, post.title].join("/")}`)
  );
}

function encodeUrlPath(value) {
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

function fileExistsCaseSensitive(filePath) {
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
}

function resolveAssetTarget(relativeBaseDir, url) {
  if (!url || url.startsWith("http") || url.startsWith("#") || url.startsWith("data:")) {
    return null;
  }

  const cleanUrl = url.split(/[?#]/, 1)[0].replace(/\\/g, "/");
  const baseDir = path.join(blogRoot, relativeBaseDir);
  const directPath = path.join(baseDir, cleanUrl);
  if (fileExistsCaseSensitive(directPath)) {
    return cleanUrl;
  }

  const assetFallback = path.posix.join("assets", cleanUrl);
  const assetFallbackPath = path.join(baseDir, assetFallback);
  if (fileExistsCaseSensitive(assetFallbackPath)) {
    return assetFallback;
  }

  return cleanUrl;
}

function rewriteMarkdownAssetLinks(content, relativePath) {
  let baseAssetUrl = `/Blog/${relativePath}`;
  if (!baseAssetUrl.endsWith("/")) {
    baseAssetUrl += "/";
  }

  let rewritten = content.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt, target) => {
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
      const resolvedTarget = resolveAssetTarget(relativePath, url) ?? url;
      finalUrl = url.startsWith("/")
        ? encodeUrlPath(url)
        : encodeUrlPath(baseAssetUrl + resolvedTarget);
    }

    return `![${alt}](${finalUrl}${title})`;
  });

  rewritten = rewritten.replace(/<img[^>]+src="([^"]+)"[^>]*>/g, (match, url) => {
    if (url.startsWith("http") || url.startsWith("data:")) {
      return match;
    }

    const resolvedTarget = resolveAssetTarget(relativePath, url) ?? url;
    const finalUrl = url.startsWith("/")
      ? encodeUrlPath(url)
      : encodeUrlPath(baseAssetUrl + resolvedTarget);

    return match.replace(url, finalUrl);
  });

  return rewritten;
}

function buildBlogEntry(urlPrefix, relPathParts, markdownPath, assetRelPathParts, existingPostLookup) {
  const rawContent = fs.readFileSync(markdownPath, "utf-8");
  const markdownStats = fs.statSync(markdownPath);
  const createdTimestampMs = getCreatedTimestampMs(markdownStats);
  const relPath = relPathParts.join("/");
  const post = {
    id: relPathParts.join("_"),
    title: path.basename(markdownPath, ".md"),
    date: formatLocalDate(createdTimestampMs),
    createdTs: Math.floor(createdTimestampMs / 1000),
    path: `${urlPrefix}/${relPath}/`,
    categories: relPathParts.slice(0, -1),
  };
  const existingPost = findExistingPost(existingPostLookup, post);

  if (existingPost?.id && existingPost.id !== post.id) {
    post.id = existingPost.id;
  }

  return {
    post,
    contentKey: relPath,
    content: rewriteMarkdownAssetLinks(rawContent, assetRelPathParts.join("/")),
  };
}

function buildFolderBlogPost(urlPrefix, relPathParts, dir, existingPostLookup) {
  const markdownPath = findFolderPostMarkdownInDir(dir);
  if (!markdownPath) {
    return null;
  }

  return buildBlogEntry(urlPrefix, relPathParts, markdownPath, relPathParts, existingPostLookup);
}

function findBlogPostsRecursive(urlPrefix, currentDir, relPathParts, skipArchive, existingPostLookup) {
  const entries = [];

  for (const file of getOrderedMarkdownFiles(currentDir)) {
    const markdownPath = path.join(currentDir, file);
    const postName = path.basename(file, path.extname(file));
    entries.push(
      buildBlogEntry(urlPrefix, [...relPathParts, postName], markdownPath, relPathParts, existingPostLookup),
    );
  }

  for (const entry of getOrderedSubdirs(currentDir)) {
    if (relPathParts.length === 0 && skipArchive && entry.name === "archive") {
      continue;
    }

    const entryPath = path.join(currentDir, entry.name);
    const nextRelPathParts = [...relPathParts, entry.name];
    const blogEntry = buildFolderBlogPost(urlPrefix, nextRelPathParts, entryPath, existingPostLookup);

    if (blogEntry) {
      entries.push(blogEntry);
    } else {
      entries.push(
        ...findBlogPostsRecursive(urlPrefix, entryPath, nextRelPathParts, skipArchive, existingPostLookup),
      );
    }
  }

  return entries;
}

function getPostFolderName(post) {
  return post.path.replace(/\/+$/, "").split("/").pop() ?? "";
}

function sortPosts(posts) {
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

function buildCategoryTree(posts) {
  const tree = {
    name: "root",
    type: "category",
    children: [],
    posts: [],
  };
  const categoryMap = new Map();

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

function buildBlogIndex(existingConfig) {
  const { fsRoot, urlPrefix, skipArchive } = getBlogContentRoot();
  const existingPostLookup = buildExistingPostLookup(existingConfig.posts);
  const blogEntries = findBlogPostsRecursive(urlPrefix, fsRoot, [], skipArchive, existingPostLookup);
  const postContentByPath = {};
  const ids = new Set();

  const posts = sortPosts(blogEntries.map((entry) => entry.post));
  for (const entry of blogEntries) {
    if (ids.has(entry.post.id)) {
      throw new Error(`Duplicate blog post id: ${entry.post.id}`);
    }

    ids.add(entry.post.id);
    postContentByPath[entry.contentKey] = entry.content;
  }

  return {
    posts,
    categoryTree: buildCategoryTree(posts),
    postContentByPath,
  };
}

function dateFromThoughtFile(file, fullPath, existingThought) {
  if (existingThought?.date) {
    return existingThought.date;
  }

  const match = file.match(/^(\d{4})-(\d{1,2})-(\d{1,2})-(\d{1,2})-(\d{1,2})\.md$/);
  if (match) {
    const [, year, month, day, hour, minute] = match;
    return `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:00`;
  }

  return fs.statSync(fullPath).birthtime.toISOString();
}

function buildThoughtIndex(existingConfig) {
  const existingThoughts = new Map(
    (existingConfig.thoughts ?? []).map((thought) => [thought.filename, thought]),
  );

  return getOrderedMarkdownFiles(thoughtRoot)
    .map((file) => {
      const fullPath = path.join(thoughtRoot, file);

      return {
        filename: file,
        date: dateFromThoughtFile(file, fullPath, existingThoughts.get(file)),
        content: fs.readFileSync(fullPath, "utf-8"),
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

const existingConfig = readExistingConfig();
const blogIndex = buildBlogIndex(existingConfig);
const thoughts = buildThoughtIndex(existingConfig);
const nextConfig = {
  site: existingConfig.site ?? defaultSite,
  posts: blogIndex.posts,
  categoryTree: blogIndex.categoryTree,
  postContentByPath: blogIndex.postContentByPath,
  thoughts,
};

fs.mkdirSync(textRoot, { recursive: true });
fs.writeFileSync(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`, "utf-8");

console.log(`Updated text/config.json with ${blogIndex.posts.length} blog posts and ${thoughts.length} thoughts.`);
