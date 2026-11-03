import { useEffect, useRef, useState } from "react"
import { Check, ChevronDown, Loader2, Sparkle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ALLOWED_SUBJECTS, type ExtractionOptions } from "@/lib/extraction"

interface ExtractionControlsProps {
  subject: string
  onSubjectChange: (value: string) => void
  options?: ExtractionOptions
  onOptionsChange?: (options: ExtractionOptions) => void
  onExtract: () => void
  isRunning: boolean
  disabled?: boolean
  /** Render the Extract button (set false when the parent places it after the dropzone). */
  showButton?: boolean
}

/** Inline (non-portaled) category picker — safe inside modals. Exported for reuse. */
export function CategoryDropdown({
  subject,
  onSubjectChange,
  options,
}: {
  subject: string
  onSubjectChange: (value: string) => void
  options?: string[]
}) {
  const items = options ?? ALLOWED_SUBJECTS
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        id="extract-subject"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`flex h-10 w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 text-sm text-slate-800 shadow-sm transition-colors focus:outline-none ${
          open
            ? "border-teal-400 ring-2 ring-teal-100"
            : "border-slate-200 hover:border-teal-300 focus-visible:border-teal-400 focus-visible:ring-2 focus-visible:ring-teal-100"
        }`}
      >
        <span className={subject ? "" : "text-slate-400"}>{subject || "Select category…"}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
        >
          {items.map((s) => {
            const selected = s === subject
            return (
              <li key={s} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => {
                    onSubjectChange(s)
                    setOpen(false)
                  }}
                  className={`flex w-full cursor-pointer items-center justify-between rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
                    selected
                      ? "bg-teal-50 font-medium text-teal-700"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {s}
                  {selected && <Check className="h-4 w-4 text-teal-600" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function ExtractionControls({
  subject,
  onSubjectChange,
  onExtract,
  isRunning,
  disabled = false,
  showButton = true,
}: ExtractionControlsProps) {
  return (
    <div className="space-y-3">
      {showButton && (
      <Button
        onClick={onExtract}
        disabled={disabled || isRunning || !subject}
        className="h-10 w-full bg-teal-600 text-white hover:bg-teal-700 disabled:bg-slate-300"
      >
        {isRunning ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Extracting script…
          </>
        ) : (
          <>
            <Sparkle className="mr-2 h-4 w-4" />
            Extract script
          </>
        )}
      </Button>
      )}
    </div>
  )
}

export default ExtractionControls
