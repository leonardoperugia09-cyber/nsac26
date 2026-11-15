import { useEffect, useState } from "react";

/** Bumps whenever saved check-ins or test results change (src/shared/api.ts fires "halo-data-change"),
 *  so views that memoise readings recompute with the new data. */
export function useDataRevision() {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const bump = () => setRevision((r) => r + 1);
    window.addEventListener("halo-data-change", bump);
    return () => window.removeEventListener("halo-data-change", bump);
  }, []);
  return revision;
}
