import { Suspense } from "react";
import UnifiedSearch from "@/components/unified-search";

export default function SearchPage() {
  return (
    <Suspense>
      <UnifiedSearch />
    </Suspense>
  );
}
