import { readBlogConfig } from "../_lib/content.js";

export default function handler(_req: any, res: any) {
  const config = readBlogConfig();
  res.status(200).json(config);
}
