import { readBlogPost } from "../_lib/content";

export default function handler(req: any, res: any) {
  const rawPath = req.query?.path;
  const postPath = Array.isArray(rawPath) ? rawPath[0] : rawPath;

  if (!postPath) {
    res.status(400).json({ error: "Missing path" });
    return;
  }

  const content = readBlogPost(postPath);
  if (!content) {
    res.status(404).send("Markdown file not found");
    return;
  }

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.status(200).send(content);
}
