import { readThoughtAsset } from "./_lib/content";

export default function handler(req: any, res: any) {
  const rawPath = req.query?.path;
  const assetPath = Array.isArray(rawPath) ? rawPath.join("/") : rawPath;

  if (!assetPath) {
    res.status(400).json({ error: "Missing asset path" });
    return;
  }

  const asset = readThoughtAsset(assetPath);
  if (!asset) {
    res.status(404).send("Asset not found");
    return;
  }

  res.setHeader("Content-Type", asset.contentType);
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.status(200).send(asset.body);
}
