import { useState } from "react"
import { marked } from "marked"
import { AlertTriangle, Braces, Code, Copy, Download, FileText, HelpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ExtractionResult } from "@/lib/extraction"
import { cn } from "@/lib/utils"

type TabId = "ocr" | "latex" | "interpret" | "issues" | "json"

interface ExtractionOutputTabsProps {
  result: ExtractionResult | null
  onCopy: (text: string, label: string) => void
  isRunning?: boolean
  // Audio transcription: show only the plain transcription text.
  audioMode?: boolean
  // Name of the recording, used for the downloaded transcription file.
  downloadName?: string
}

const renderMarkdown = (text: string) => {
  try {
    return { __html: marked.parse(text || "", { async: false }) as string }
  } catch {
    return { __html: text }
  }
}

const downloadTxt = (text: string, filename: string) => {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const FIGURES: { key: "diagram" | "table" | "graph"; symbol: string; label: string }[] = [
  { key: "diagram", symbol: "D", label: "Diagram" },
  { key: "table", symbol: "T", label: "Table" },
  { key: "graph", symbol: "G", label: "Graph" },
]

function DtgBar({ result }: { result: ExtractionResult | null }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {FIGURES.map((fig) => {
        const count = result?.figure_counts?.[fig.key] ?? 0
        const present = Boolean(result && (count > 0 || (result.blocks && result.blocks.includes(fig.key))))
        return (
          <span
            key={fig.key}
            title={
              !result
                ? `${fig.label}: awaiting extraction`
                : present
                ? `${fig.label}: ${count} detected`
                : `${fig.label}: not present on page`
            }
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
              present
                ? "border-teal-200 bg-teal-50 text-teal-700"
                : "border-slate-200 bg-slate-50 text-slate-500"
            )}
          >
            <span
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded-[3px] text-[10px] font-bold",
                present ? "bg-teal-600 text-white" : "bg-slate-200 text-slate-500"
              )}
            >
              {fig.symbol}
            </span>
            {fig.label}
            {result ? ` (${count})` : ""}
          </span>
        )
      })}
    </div>
  )
}

/** Elegant overlay loader shown while extraction runs. */
function ExtractionLoader() {
  return (
    <div className="flex min-h-[280px] flex-1 flex-col items-center justify-center gap-4 rounded-lg border border-slate-200 bg-slate-50">
      <div className="relative h-12 w-12">
        <span className="absolute inset-0 rounded-full border-2 border-teal-100" />
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-teal-600" />
        <span className="absolute inset-[9px] animate-pulse rounded-full bg-teal-600/10" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-slate-700">Extracting script…</p>
        <p className="mt-1 text-xs text-slate-400">Reading handwriting, math and figures from the page</p>
      </div>
      <div className="flex gap-1.5">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-500 [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-500 [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-500 [animation-delay:300ms]" />
      </div>
    </div>
  )
}

export function ExtractionOutputTabs({ result, onCopy, isRunning = false, audioMode = false, downloadName }: ExtractionOutputTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("ocr")
  const issuesCount = result?.issues?.length ?? 0
  // An audio transcription has no LaTeX, figures, interpretation or audit, so only
  // the plain transcription is shown.
  const currentTab: TabId = audioMode ? "ocr" : activeTab

  const allTabs: { id: TabId; label: string; icon: typeof FileText }[] = [
    { id: "ocr", label: "OCR transcription", icon: FileText },
    { id: "latex", label: "Raw LaTeX", icon: Code },
    { id: "interpret", label: "Interpretation", icon: HelpCircle },
    { id: "issues", label: `Protocol audit (${issuesCount})`, icon: AlertTriangle },
    { id: "json", label: "JSON", icon: Braces },
  ]
  const tabs = audioMode ? allTabs.filter((tab) => tab.id === "ocr") : allTabs

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 px-1.5 pt-1.5">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const active = currentTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-t-lg border-b-2 px-3 py-2 text-xs font-medium transition-colors",
                active
                  ? "border-teal-600 text-teal-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          )
        })}
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 p-3">
        {isRunning ? (
          <ExtractionLoader />
        ) : (
        <>
        {currentTab === "ocr" && (
          <>
            {audioMode && result?.transcription && (
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 shrink-0 border-teal-300 bg-teal-50 px-2.5 text-xs text-teal-700 hover:bg-teal-100"
                  onClick={() => downloadTxt(
                    result.transcription,
                    `${(downloadName || 'transcription').replace(/\.[^.]+$/, '')}-transcription.txt`
                  )}
                >
                  <Download className="mr-1 h-3 w-3" />
                  Download
                </Button>
              </div>
            )}
            {!audioMode && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] text-slate-500">
                Plain-text transcription with Unicode math and Markdown tables
              </span>
              <DtgBar result={result} />
              {result?.transcription && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 shrink-0 border-slate-300 px-2.5 text-xs"
                  onClick={() => onCopy(result.transcription, "Transcription")}
                >
                  <Copy className="mr-1 h-3 w-3" />
                  Copy text
                </Button>
              )}
            </div>
            )}
            {result?.transcription ? (
              <div
                className="min-h-[200px] flex-1 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-700 sm:text-sm [&_table]:w-full [&_table_td]:border [&_table_td]:border-slate-200 [&_table_td]:px-2 [&_table_td]:py-1 [&_table_th]:border [&_table_th]:border-slate-200 [&_table_th]:bg-white [&_table_th]:px-2 [&_table_th]:py-1"
                dangerouslySetInnerHTML={renderMarkdown(result.transcription)}
              />
            ) : (
              <p className="min-h-[200px] flex-1 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-400">
                {result
                  ? "No transcription text was returned for this page."
                  : 'Select a subject and click "Extract script" to begin extraction…'}
              </p>
            )}
          </>
        )}

        {currentTab === "latex" && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] text-slate-500">Raw LaTeX extracted from the page</span>
              <DtgBar result={result} />
              {result?.transcription_latex && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 shrink-0 border-slate-300 px-2.5 text-xs"
                    onClick={() => onCopy(result.transcription_latex, "LaTeX")}
                  >
                    <Copy className="mr-1 h-3 w-3" />
                    Copy LaTeX
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 shrink-0 border-teal-300 bg-teal-50 px-2.5 text-xs text-teal-700 hover:bg-teal-100"
                    onClick={() => downloadTxt(result.transcription_latex, "raw-latex.txt")}
                  >
                    <Download className="mr-1 h-3 w-3" />
                    Download .txt
                  </Button>
                </>
              )}
            </div>
            <pre className="min-h-[200px] flex-1 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-700">
              {result?.transcription_latex || (result ? "No LaTeX was returned for this page." : "LaTeX view will be displayed here…")}
            </pre>
          </>
        )}

        {currentTab === "interpret" && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] text-slate-500">
                Grounded descriptions of diagrams, graphs, chemistry and maps
              </span>
              <DtgBar result={result} />
              {result?.interpretation && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 shrink-0 border-slate-300 px-2.5 text-xs"
                  onClick={() => onCopy(result.interpretation, "Interpretation")}
                >
                  <Copy className="mr-1 h-3 w-3" />
                  Copy interpretation
                </Button>
              )}
            </div>
            {result?.interpretation ? (
              <div
                className="min-h-[200px] flex-1 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-700 sm:text-sm"
                dangerouslySetInnerHTML={renderMarkdown(result.interpretation)}
              />
            ) : (
              <p className="min-h-[200px] flex-1 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-400">
                {result
                  ? "No visual elements were described for this page."
                  : "Visual element descriptions will appear here…"}
              </p>
            )}
          </>
        )}

        {currentTab === "issues" && (
          <>
            <span className="text-[11px] text-slate-500">
              Deterministic protocol checks and quality audit warnings
            </span>
            <div className="min-h-[200px] flex-1 space-y-2 overflow-auto">
              {issuesCount > 0 ? (
                result!.issues.map((issue, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800"
                  >
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                    <span>{issue}</span>
                  </div>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-400">
                  No protocol audit issues flagged.
                </p>
              )}
            </div>
          </>
        )}
        </>
        )}
        {currentTab === "json" && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] text-slate-500">
                Everything the extraction holds for this page, as raw JSON
              </span>
              {result && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 shrink-0 border-slate-300 px-2.5 text-xs"
                  onClick={() => onCopy(JSON.stringify(result, null, 2), "JSON")}
                >
                  <Copy className="mr-1 h-3 w-3" />
                  Copy JSON
                </Button>
              )}
            </div>
            {result ? (
              <pre className="min-h-[200px] flex-1 overflow-auto rounded-lg border border-slate-200 bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-slate-100">
{JSON.stringify(result, null, 2)}
              </pre>
            ) : (
              <p className="min-h-[200px] flex-1 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-400">
                Select a page to see its data, or run an extraction…
              </p>
            )}
          </>
        )}

      </div>
    </div>
  )
}

export default ExtractionOutputTabs
