import { Suspense } from "react";
import ReportView from "@/components/report-view";

export default function ReportPage() {
  return (
    <Suspense>
      <ReportView />
    </Suspense>
  );
}
