import { listThoughts } from "./_lib/content.js";

export default function handler(_req: any, res: any) {
  res.status(200).json(listThoughts());
}
