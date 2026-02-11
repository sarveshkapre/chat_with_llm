import { Suspense } from "react";
import { notFound } from "next/navigation";
import UnifiedSearch from "@/components/unified-search";
import { UNIFIED_SEARCH_SMOKE_ZERO_RESULTS_BOOTSTRAP } from "@/lib/unified-search-smoke-fixture";

export const dynamic = "force-dynamic";

export default function UnifiedSearchSmokeZeroResultsPage() {
  if (process.env.SMOKE_ENABLE_SEARCH_FIXTURE !== "1") {
    notFound();
  }

  return (
    <Suspense>
      <UnifiedSearch initialBootstrap={UNIFIED_SEARCH_SMOKE_ZERO_RESULTS_BOOTSTRAP} />
    </Suspense>
  );
}
