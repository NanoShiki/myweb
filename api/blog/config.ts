import { readBlogConfig } from "../_lib/content";

export default function handler(_req: any, res: any) {
  const config = readBlogConfig();

  if (!config) {
    res.status(404).json({ error: "Blog config not found" });
    return;
  }

  res.status(200).json(config);
}
