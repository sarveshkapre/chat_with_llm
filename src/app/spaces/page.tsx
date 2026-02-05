import { Suspense } from "react";
import SpacesView from "@/components/spaces-view";

export default function SpacesPage() {
  return (
    <Suspense>
      <SpacesView />
    </Suspense>
  );
}
