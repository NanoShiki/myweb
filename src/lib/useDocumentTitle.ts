import { useEffect } from "react";

export const SITE_TITLE = "NanoShiki's ORARIO";

export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} | ${SITE_TITLE}` : SITE_TITLE;
  }, [title]);
}
