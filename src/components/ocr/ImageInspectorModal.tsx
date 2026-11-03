import { useEffect, useRef, useState } from "react"
import { Download, Maximize2, Move, RotateCcw, X, ZoomIn, ZoomOut } from "lucide-react"

interface ImageInspectorModalProps {
  imageUrl: string
  label: string
  onClose: () => void
}

/** Full-screen image inspector: dark overlay, toolbar actions, wheel zoom + drag pan. */
export function ImageInspectorModal({ imageUrl, label, onClose }: ImageInspectorModalProps) {
  const [zoom, setZoom] = useState(100)
  const [isPanning, setIsPanning] = useState(false)
  const viewportRef = useRef<HTMLDivElement>(null)
  const panStart = useRef({ x: 0, y: 0, left: 0, top: 0 })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(500, z + 25))
      if (e.key === "-") setZoom((z) => Math.max(40, z - 25))
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const fit = () => {
    setZoom(100)
    if (viewportRef.current) {
      viewportRef.current.scrollLeft = 0
      viewportRef.current.scrollTop = 0
    }
  }

  const download = () => {
    const a = document.createElement("a")
    a.href = imageUrl
    a.download = label || "script-page"
    a.click()
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 p-3 backdrop-blur-sm sm:p-6"
      style={{ pointerEvents: "auto" }}
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-700/60 bg-slate-800/80 px-3 py-2.5 sm:px-4">
          <div className="flex min-w-0 items-center gap-2 text-slate-100">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-teal-600/20 text-teal-400">
              <Maximize2 className="h-3.5 w-3.5" />
            </span>
            <span className="truncate text-sm font-medium">{label}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(40, z - 25))}
              className="rounded-lg p-2 text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
              title="Zoom out (−)"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="w-14 rounded-md bg-slate-700/60 px-2 py-1 text-center text-xs font-medium tabular-nums text-teal-300">
              {zoom}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(500, z + 25))}
              className="rounded-lg p-2 text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
              title="Zoom in (+)"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={fit}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
              title="Fit to view"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Fit
            </button>
            <button
              type="button"
              onClick={download}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
              title="Download image"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </button>
            <div className="mx-1 h-5 w-px bg-slate-700" />
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-300 transition-colors hover:bg-red-500/20 hover:text-red-400"
              title="Close (Esc)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Viewport: wheel zoom + drag pan */}
        <div
          ref={viewportRef}
          className="flex-1 overflow-auto bg-slate-950/60 p-4"
          style={{ cursor: isPanning ? "grabbing" : "grab" }}
          onWheel={(e) => {
            e.preventDefault()
            setZoom((z) => Math.min(500, Math.max(40, z + (e.deltaY < 0 ? 15 : -15))))
          }}
          onMouseDown={(e) => {
            if (!viewportRef.current) return
            setIsPanning(true)
            panStart.current = {
              x: e.clientX,
              y: e.clientY,
              left: viewportRef.current.scrollLeft,
              top: viewportRef.current.scrollTop,
            }
          }}
          onMouseMove={(e) => {
            if (!isPanning || !viewportRef.current) return
            e.preventDefault()
            viewportRef.current.scrollLeft = panStart.current.left - (e.clientX - panStart.current.x)
            viewportRef.current.scrollTop = panStart.current.top - (e.clientY - panStart.current.y)
          }}
          onMouseUp={() => setIsPanning(false)}
          onMouseLeave={() => setIsPanning(false)}
        >
          <div className="mx-auto" style={{ width: `${zoom}%`, minWidth: "100%" }}>
            <img
              src={imageUrl}
              alt={label}
              draggable={false}
              className="pointer-events-none block w-full select-none rounded-lg bg-white shadow-2xl"
            />
          </div>
        </div>

        {/* Footer hints */}
        <div className="flex items-center justify-center gap-4 border-t border-slate-700/60 bg-slate-800/80 px-4 py-2 text-[11px] text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <Move className="h-3 w-3 text-teal-400" />
            Drag to pan
          </span>
          <span>·</span>
          <span>Mouse wheel to zoom</span>
          <span>·</span>
          <span>
            <kbd className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-200">Esc</kbd> to close
          </span>
        </div>
      </div>
    </div>
  )
}

export default ImageInspectorModal
