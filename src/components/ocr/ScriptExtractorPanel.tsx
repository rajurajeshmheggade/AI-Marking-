import { useMemo, useRef, useState, useEffect } from "react"
import { AudioLines, ChevronLeft, ChevronRight, Edit3, Image as ImageIcon, Loader2, Maximize2, RotateCcw, Sparkle, Upload, X, ZoomIn, ZoomOut } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ExtractionControls } from "@/components/ocr/ExtractionControls"
import { ExtractionOutputTabs } from "@/components/ocr/ExtractionOutputTabs"
import {
  DEFAULT_OPTIONS,
  runExtraction,
  type ExtractionOptions,
  type ExtractionResult,
} from "@/lib/extraction"
import { cn } from "@/lib/utils"

/**
 * Detects the byte-offset where a raw LaTeX section begins inside a mixed
 * transcription string produced by the OCR API.
 *
 * The transcription can contain:
 *   1. Markdown table rows  (the main answer content)
 *   2. Trailing raw LaTeX   (\square, \hline, \begin{tabular} …)
 *
 * Returns the character index of the first LaTeX line, or -1 when no LaTeX
 * is found (meaning the entire string is plain Markdown / plain text).
 */
function findLatexStartIndex(text: string): number {
  if (!text) return -1
  const lines = text.split('\n')
  // Patterns that indicate a LaTeX line
  const latexLineRe = /(?:\\square|\\hline|\\begin\{|\\end\{|\\[a-zA-Z]+\s*&)/
  let charPos = 0
  for (const line of lines) {
    if (latexLineRe.test(line)) return charPos
    charPos += line.length + 1 // +1 for the '\n'
  }
  return -1
}


export interface ExtractorSegment {
  id: number
  imageUrl: string
  label: string
  ocrText: string
  // Rich metadata — present when the segment comes from the new API object format
  ocrBlocks?: string[]
  ocrFigureCounts?: { graph?: number; diagram?: number; table?: number }
  ocrTokens?: { input?: number; output?: number; thinking?: number; total?: number; calls?: number }
  ocrSubject?: string
  ocrIssues?: string[]
  ocrTranscriptionLatex?: string
  ocrInterpretation?: string
  // True when this segment came from a saved API record, even if its transcription
  // is blank - distinguishes "extracted, nothing found" from "never extracted".
  ocrHasData?: boolean
  // True for an audio recording (Standalone OCR with Audio input): imageUrl then
  // points at the recording, which is played rather than shown as a page.
  isAudio?: boolean
}

/**
 * The data already held for one page, shaped like an extraction result so the
 * output tabs (including the JSON tab) can show it without re-running OCR.
 * Returns null when the page carries nothing yet.
 */
function segmentToResult(segment: ExtractorSegment | undefined): ExtractionResult | null {
  if (!segment) return null
  const hasData = Boolean(
    segment.ocrHasData ||
    segment.ocrText ||
    segment.ocrTranscriptionLatex ||
    segment.ocrInterpretation ||
    (segment.ocrBlocks && segment.ocrBlocks.length) ||
    (segment.ocrIssues && segment.ocrIssues.length)
  )
  if (!hasData) return null
  return {
    subject: segment.ocrSubject ?? '',
    blocks: segment.ocrBlocks ?? [],
    transcription: segment.ocrText ?? '',
    transcription_latex: segment.ocrTranscriptionLatex ?? '',
    interpretation: segment.ocrInterpretation ?? '',
    issues: segment.ocrIssues ?? [],
    insertions_placed: 0,
    figure_counts: {
      graph: segment.ocrFigureCounts?.graph ?? 0,
      diagram: segment.ocrFigureCounts?.diagram ?? 0,
      table: segment.ocrFigureCounts?.table ?? 0,
    },
    tokens: {
      input: segment.ocrTokens?.input ?? 0,
      output: segment.ocrTokens?.output ?? 0,
      thinking: segment.ocrTokens?.thinking ?? 0,
      total: segment.ocrTokens?.total ?? 0,
      calls: segment.ocrTokens?.calls ?? 0,
    },
  }
}

interface ScriptExtractorPanelProps {
  segments: ExtractorSegment[]
  onInspectImage: (image: { url: string; label: string }) => void
}

export function ScriptExtractorPanel({ segments, onInspectImage }: ScriptExtractorPanelProps) {
  const [activeSegmentId, setActiveSegmentId] = useState<number>(segments[0]?.id ?? 0)
  const [subject, setSubject] = useState("General")
  const [options, setOptions] = useState<ExtractionOptions>(DEFAULT_OPTIONS)
  const [zoomLevel, setZoomLevel] = useState(100)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ExtractionResult | null>(() => segmentToResult(segments[0]))

  // Uploaded page (drag & drop) overrides the candidate's segment image.
  const [upload, setUpload] = useState<{ file: File; url: string } | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Click-and-drag panning of the zoomed page.
  const viewportRef = useRef<HTMLDivElement>(null)
  const panStart = useRef({ x: 0, y: 0, left: 0, top: 0 })
  const [isPanning, setIsPanning] = useState(false)

  const activeSegment = useMemo(
    () => segments.find((s) => s.id === activeSegmentId) ?? segments[0],
    [segments, activeSegmentId]
  )

  // Automatically load the pre-extracted OCR text into the result state when switching segments
  useEffect(() => {
    if (activeSegment && (activeSegment.ocrHasData || activeSegment.ocrText)) {
      // Separate plain markdown/text portion from raw LaTeX at the tail of the transcription.
      // The LaTeX portion starts at the first line that looks like a LaTeX table cell or environment.
      const raw = activeSegment.ocrText
      const latexStartIdx = findLatexStartIndex(raw)
      const markdownPart = latexStartIdx > 0 ? raw.slice(0, latexStartIdx).trimEnd() : raw
      const latexPart    = latexStartIdx > 0 ? raw.slice(latexStartIdx).trimStart() : ''

      setResult({
        subject:           activeSegment.ocrSubject      ?? 'General',
        blocks:            activeSegment.ocrBlocks        ?? [],
        transcription:     markdownPart,
        transcription_latex: activeSegment.ocrTranscriptionLatex || latexPart,
        interpretation:    activeSegment.ocrInterpretation || '',
        issues:            activeSegment.ocrIssues        ?? [],
        insertions_placed: 0,
        figure_counts: {
          graph:   activeSegment.ocrFigureCounts?.graph   ?? 0,
          diagram: activeSegment.ocrFigureCounts?.diagram ?? 0,
          table:   activeSegment.ocrFigureCounts?.table   ?? 0,
        },
        tokens: {
          input:    activeSegment.ocrTokens?.input    ?? 0,
          output:   activeSegment.ocrTokens?.output   ?? 0,
          thinking: activeSegment.ocrTokens?.thinking ?? 0,
          total:    activeSegment.ocrTokens?.total    ?? 0,
          calls:    activeSegment.ocrTokens?.calls    ?? 0,
        },
      })
    } else {
      setResult(null)
    }
  }, [activeSegment])

  const source = upload
    ? { url: upload.url, label: upload.file.name }
    : activeSegment
    ? { url: activeSegment.imageUrl, label: activeSegment.label }
    : null

  const acceptFile = (file?: File | null) => {
    if (!file) return
    setUpload({ file, url: URL.createObjectURL(file) })
    setZoomLevel(100)
    setResult(null)
    setError(null)
  }

  const handleCopy = (text: string, label: string) => {
    if (!text) return
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success(`${label} copied to clipboard`))
      .catch(() => toast.error("Failed to copy text"))
  }

  const handleExtract = async () => {
    if (!source) return
    setIsRunning(true)
    setError(null)
    try {
      const res = await runExtraction({
        subject,
        file: upload?.file ?? null,
        imageUrl: upload ? undefined : source.url,
        options,
      })
      setResult(res)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Extraction failed. Please try again."
      setError(message)
      toast.error(message)
    } finally {
      setIsRunning(false)
    }
  }

  const startPan = (e: React.MouseEvent) => {
    if (!viewportRef.current) return
    setIsPanning(true)
    panStart.current = {
      x: e.clientX,
      y: e.clientY,
      left: viewportRef.current.scrollLeft,
      top: viewportRef.current.scrollTop,
    }
  }

  const movePan = (e: React.MouseEvent) => {
    if (!isPanning || !viewportRef.current) return
    viewportRef.current.scrollLeft = panStart.current.left - (e.clientX - panStart.current.x)
    viewportRef.current.scrollTop = panStart.current.top - (e.clientY - panStart.current.y)
  }

  if (!source) return null

  return (
    /* Workspace grid — left: Extraction Input panel · right: metrics + results */
    <div className="grid w-full min-w-0 grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      {/* ── Left panel: Extraction Input ───────────────────────── */}
      <section className="flex min-w-0 flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Edit3 className="h-4 w-4 text-teal-600" />
          Extraction Input
        </h3>

        {/* Subject category, question filter and execution toggles */}
        <ExtractionControls
          subject={subject}
          onSubjectChange={setSubject}
          options={options}
          onOptionsChange={setOptions}
          onExtract={handleExtract}
          isRunning={isRunning}
          showButton={false}
        />

        {/* Script page image — candidate pages or an uploaded replacement */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-600">
              {segments.every((s) => s.isAudio) ? "Audio recording(s)" : "Script page image(s)"} <span className="text-red-500">*</span>
            </span>
            {segments.length > 1 && (
              <span className="text-[11px] tabular-nums text-slate-400">
                Page {Math.max(0, segments.findIndex((s) => s.id === activeSegment?.id)) + 1} of {segments.length}
              </span>
            )}
          </div>

          {/* Thumbnail strip: a small preview per page instead of a plain text
              pill, so pages are told apart at a glance; the dot shows which
              pages already carry extracted OCR data. Scrolls horizontally
              instead of wrapping, so it stays usable with many pages. */}
          <div className="flex items-center gap-1">
            {segments.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  const idx = segments.findIndex((s) => s.id === activeSegment?.id)
                  const prev = segments[(idx - 1 + segments.length) % segments.length]
                  setUpload(null)
                  setActiveSegmentId(prev.id)
                  setZoomLevel(100)
                  setResult(segmentToResult(prev))
                  setError(null)
                }}
                className="shrink-0 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                title="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-1">
              {segments.map((segment) => {
                const active = !upload && segment.id === activeSegment?.id
                const hasData = Boolean(segment.ocrHasData || segment.ocrText)
                return (
                  <button
                    key={segment.id}
                    type="button"
                    onClick={() => {
                      setUpload(null)
                      setActiveSegmentId(segment.id)
                      setZoomLevel(100)
                      // Show what this page already holds (see the JSON tab) instead of
                      // clearing the panel until an extraction is run again.
                      setResult(segmentToResult(segment))
                      setError(null)
                    }}
                    title={segment.label}
                    className={cn(
                      "flex shrink-0 flex-col items-center gap-1 rounded-lg border p-1 transition-colors",
                      active
                        ? "border-teal-500 bg-teal-50 ring-1 ring-teal-500"
                        : "border-slate-200 bg-white hover:border-teal-300"
                    )}
                  >
                    <span className="relative flex h-12 w-10 items-center justify-center overflow-hidden rounded bg-slate-100">
                      {segment.isAudio ? (
                        <AudioLines className="h-5 w-5 text-indigo-400" />
                      ) : (
                        <img
                          src={segment.imageUrl}
                          alt={segment.label}
                          className="h-full w-full object-cover"
                          draggable={false}
                        />
                      )}
                      <span
                        className={cn(
                          "absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full border border-white",
                          hasData ? "bg-emerald-500" : "bg-slate-300"
                        )}
                        title={hasData ? "Already extracted" : "Not extracted yet"}
                      />
                    </span>
                    <span
                      className={cn(
                        "max-w-[48px] truncate text-[10px] font-medium",
                        active ? "text-teal-700" : "text-slate-500"
                      )}
                    >
                      {segment.label}
                    </span>
                  </button>
                )
              })}
            </div>
            {segments.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  const idx = segments.findIndex((s) => s.id === activeSegment?.id)
                  const next = segments[(idx + 1) % segments.length]
                  setUpload(null)
                  setActiveSegmentId(next.id)
                  setZoomLevel(100)
                  setResult(segmentToResult(next))
                  setError(null)
                }}
                className="shrink-0 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                title="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Audio recording: played instead of the image viewer; its transcription
              is shown in the results panel on the right. */}
          {!upload && activeSegment?.isAudio ? (
            <div className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-3 py-2">
                <AudioLines className="h-3.5 w-3.5 shrink-0 text-indigo-600" />
                <span className="truncate text-xs font-medium text-slate-700">{source.label}</span>
              </div>
              <div className="flex flex-col items-center justify-center gap-3 bg-slate-50 p-6">
                <AudioLines className="h-10 w-10 text-indigo-400" />
                <audio
                  key={source.url}
                  src={source.url}
                  controls
                  controlsList="nodownload noplaybackrate"
                  onContextMenu={(e) => e.preventDefault()}
                  className="w-full"
                />
              </div>
            </div>
          ) : (
          /* Dropzone / preview with zoom, drag-pan and full inspector */
          <div
            className={cn(
              "flex min-w-0 flex-col overflow-hidden rounded-lg border bg-white transition-colors",
              isDragOver ? "border-teal-400 ring-2 ring-teal-100" : "border-slate-200"
            )}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragOver(true)
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setIsDragOver(false)
              acceptFile(e.dataTransfer.files?.[0])
            }}
          >
            {/* Preview header bar: filename · zoom controls · inspect · remove */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <ImageIcon className="h-3.5 w-3.5 shrink-0 text-teal-600" />
                <span className="truncate text-xs font-medium text-slate-700">{source.label}</span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.max(40, z - 25))}
                  className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-200"
                  title="Zoom out"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <span className="w-10 text-center text-[11px] tabular-nums text-slate-500">{zoomLevel}%</span>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.min(400, z + 25))}
                  className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-200"
                  title="Zoom in"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel(100)}
                  className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-200"
                  title="Reset zoom"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onInspectImage({ url: source.url, label: source.label })}
                  className="ml-1 inline-flex items-center gap-1 rounded-md border border-teal-200 bg-teal-50 px-2 py-1 text-[11px] font-medium text-teal-700 transition-colors hover:bg-teal-100"
                  title="Expand full interactive inspector"
                >
                  <Maximize2 className="h-3 w-3" />
                  Inspect
                </button>
                {upload && (
                  <button
                    type="button"
                    onClick={() => {
                      setUpload(null)
                      setResult(null)
                      setError(null)
                      setZoomLevel(100)
                    }}
                    className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600"
                    title="Remove uploaded image"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
            <div
              ref={viewportRef}
              className="h-[380px] overflow-auto bg-slate-50 p-2 sm:h-[460px]"
              style={{ cursor: isPanning ? "grabbing" : "grab" }}
              onMouseDown={startPan}
              onMouseMove={movePan}
              onMouseUp={() => setIsPanning(false)}
              onMouseLeave={() => setIsPanning(false)}
              onDoubleClick={() => onInspectImage({ url: source.url, label: source.label })}
              title="Drag to pan · double click to open the inspector"
            >
              <div style={{ width: `${zoomLevel}%`, minWidth: "100%" }}>
                <img
                  src={source.url}
                  alt={source.label}
                  className="pointer-events-none block w-full select-none"
                  draggable={false}
                />
              </div>
            </div>
          </div>
          )}
        </div>
      </section>

      {/* ── Right panel: error · tabbed results ── */}
      <section className="flex min-h-0 min-w-0 flex-col gap-3">
        {error && (
          <div className="flex items-start justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <span className="min-w-0">{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="shrink-0 rounded p-0.5 hover:bg-red-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <ExtractionOutputTabs
          result={result}
          onCopy={handleCopy}
          isRunning={isRunning}
          audioMode={!upload && !!activeSegment?.isAudio}
          downloadName={source.label}
        />
      </section>
    </div>
  )
}

export default ScriptExtractorPanel
