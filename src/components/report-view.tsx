"use client";

import { useEffect, useMemo, useState } from "react";
import type { AnswerResponse } from "@/lib/types/answer";
import { readStoredJson } from "@/lib/storage";

const STORAGE_KEY = "signal-history-v2";

export default function ReportView() {
  const [notice, setNotice] = useState<string | null>(null);

  const report = useMemo(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (!id) return null;
    const threads = readStoredJson<AnswerResponse[]>(STORAGE_KEY, []);
    return threads.find((thread) => thread.id === id) ?? null;
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const formatted = useMemo(() => {
    if (!report) return [] as string[];
    return report.answer.split("\n\n");
  }, [report]);

  function downloadHtml() {
    if (!report) return;
    const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${report.question}</title>
<style>
body { font-family: ui-sans-serif, system-ui; margin: 40px; color: #0f172a; }
header { margin-bottom: 24px; }
section { margin-bottom: 16px; }
small { color: #64748b; }
</style>
</head>
<body>
<header>
<h1>${report.question}</h1>
<small>Mode: ${report.mode} · Sources: ${report.sources === "web" ? "Web" : "Offline"}</small>
</header>
${report.answer
  .split("\n\n")
  .map((paragraph) => `<section>${paragraph}</section>`)
  .join("\n")}
<h2>Sources</h2>
<ul>
${report.citations
  .map((citation) => `<li><a href="${citation.url}">${citation.title}</a></li>`)
  .join("\n")}
</ul>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `signal-report-${report.id}.html`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function printPdf() {
    window.print();
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).catch(() => null);
    setNotice("Report link copied.");
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-signal-bg text-signal-text px-6 py-16">
        <p className="text-sm text-signal-muted">
          Report not found. Open a research thread from the library and select
          “Open report.”
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-signal-bg text-signal-text">
      <header className="border-b border-white/10 px-6 py-6">
        <p className="text-xs uppercase tracking-[0.3em] text-signal-muted">
          Research Report
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-signal-text">
          {report.question}
        </h1>
        <p className="mt-2 text-sm text-signal-muted">
          Mode: {report.mode} · Sources: {report.sources === "web" ? "Web" : "Offline"}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={downloadHtml}
            className="rounded-full border border-white/10 px-4 py-2 text-xs text-signal-text"
          >
            Export HTML
          </button>
          <button
            onClick={printPdf}
            className="rounded-full border border-white/10 px-4 py-2 text-xs text-signal-text"
          >
            Print / Save PDF
          </button>
          <button
            onClick={copyLink}
            className="rounded-full border border-white/10 px-4 py-2 text-xs text-signal-text"
          >
            Copy link
          </button>
        </div>
      </header>

      <main className="px-6 py-8">
        <div className="space-y-6 text-sm leading-7">
          {formatted.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
        <div className="mt-10">
          <p className="text-xs uppercase tracking-[0.2em] text-signal-muted">
            Sources
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {report.citations.length ? (
              report.citations.map((citation, index) => (
                <a
                  key={`${citation.url}-${index}`}
                  href={citation.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-white/10 px-3 py-1 text-xs text-signal-text"
                >
                  {index + 1}. {citation.title}
                </a>
              ))
            ) : (
              <p className="text-sm text-signal-muted">No sources.</p>
            )}
          </div>
        </div>
      </main>

      {notice ? (
        <div className="fixed bottom-6 right-6 rounded-2xl border border-white/10 bg-signal-surface/90 px-4 py-2 text-xs text-signal-text shadow-xl">
          {notice}
        </div>
      ) : null}
    </div>
  );
}
