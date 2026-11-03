import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { X } from "lucide-react"
import { ScriptExtractorPanel } from "@/components/ocr/ScriptExtractorPanel"
import { ImageInspectorModal } from "@/components/ocr/ImageInspectorModal"
import ocrAnswerSheet1 from "@/assets/ocr-answer-sheet-1.png"
import ocrAnswerSheet2 from "@/assets/ocr-answer-sheet-2.png"
import ocrAnswerSheet3 from "@/assets/ocr-answer-sheet-3.png"

interface SegmentImage {
  id: number
  imageUrl: string
  label: string
  ocrText: string
}

// ─── Fallback mock data (used when no real result is found in sessionStorage) ─
const MOCK_SEGMENTS: SegmentImage[] = [
  { id: 1, imageUrl: ocrAnswerSheet1, label: "Section A - Q1-10", ocrText: "Q1. The photosynthesis process occurs in the chloroplast of plant cells. During this process, light energy is converted into chemical energy stored in glucose molecules.\n\nQ2. The answer discusses cellular respiration and its role in ATP production through the electron transport chain." },
  { id: 2, imageUrl: ocrAnswerSheet2, label: "Section B - Q11-20", ocrText: "Q11. The mitochondria is known as the powerhouse of the cell because it produces ATP through oxidative phosphorylation.\n\nQ12. DNA replication is a semi-conservative process where each new double helix contains one original strand and one new strand." },
  { id: 3, imageUrl: ocrAnswerSheet3, label: "Section C - Q21-30", ocrText: "Q21. Evolution is driven by natural selection, where organisms with favorable traits are more likely to survive and reproduce.\n\nQ22. The nervous system coordinates body functions through electrical impulses transmitted along neurons." },
]

// ─── Read real OCR result stored by OCREvaluation after AI Transcription ─────
interface StoredOcrResult {
  ocrExtractedText: Record<string, Record<string, string>>
  scriptPath: string
  fileNames: string[]
  transcribedTexts: string[]
  imageDataUrls: string[]
  workspaceId: number | string
  registrationNumber: string
  savedAt: number
}

const readStoredOcrResult = (): StoredOcrResult | null => {
  try {
    const raw = sessionStorage.getItem('standalone_ocr_result')
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredOcrResult
    // Treat as expired after 24 h so stale data is not shown forever
    if (parsed.savedAt && Date.now() - parsed.savedAt > 24 * 60 * 60 * 1000) {
      sessionStorage.removeItem('standalone_ocr_result')
      return null
    }
    return parsed
  } catch {
    return null
  }
}

const buildSegmentsFromStoredResult = (stored: StoredOcrResult): SegmentImage[] => {
  const { fileNames, transcribedTexts, imageDataUrls } = stored
  if (!fileNames || fileNames.length === 0) return MOCK_SEGMENTS
  return fileNames.map((name, i) => ({
    id: i + 1,
    // Use the base64 data URL if available, otherwise fall back to placeholder
    imageUrl: imageDataUrls?.[i] || ocrAnswerSheet1,
    label: name,
    ocrText: transcribedTexts?.[i] ?? '',
  }))
}

interface StandaloneOCREvaluationProps {
  open: boolean;
  onClose: () => void;
  segments: SegmentImage[];
}

const StandaloneOCREvaluation = ({ open, onClose, segments }: StandaloneOCREvaluationProps) => {
  const [popupImage, setPopupImage] = useState<{ url: string; label: string } | null>(null)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="max-w-[95vw] w-[1400px] h-[90vh] flex flex-col p-0 overflow-hidden border bg-white rounded-xl shadow-2xl z-[100] [&>button]:hidden"
        // The review stays open until its own Close button is used; a click
        // outside must not dismiss it mid-review.
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">Standalone OCR Evaluation</DialogTitle>
        <div className="flex items-center justify-between px-6 py-4 border-b bg-slate-50/80 backdrop-blur-sm shrink-0">
          <h2 className="text-lg font-semibold text-slate-800">OCR Review</h2>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={onClose} 
                  className="h-8 w-8 rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition-colors"
                >
                  <X className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              {/* The dialog sits at z-[100]; without a higher z-index the tooltip is
                  portaled behind it and never becomes visible. */}
              <TooltipContent side="bottom" className="text-xs py-1 px-2 bg-white text-slate-800 border border-slate-200 rounded-md shadow-sm z-[120]">
                Close
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="flex-1 overflow-hidden p-4">
          <div className="h-full bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col overflow-hidden">
            <ScrollArea className="flex-1 bg-slate-50 h-full">
              <div className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 h-full">
                {segments && segments.length > 0 ? (
                  <ScriptExtractorPanel
                    segments={segments}
                    onInspectImage={setPopupImage}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-500">
                    No OCR data found for this candidate.
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <Dialog open={!!popupImage} onOpenChange={() => setPopupImage(null)}>
          <DialogContent className="left-0 top-0 h-screen w-screen max-w-none translate-x-0 translate-y-0 overflow-hidden border-0 bg-transparent p-0 shadow-none [&>button]:hidden z-[110]">
            {popupImage && (
              <ImageInspectorModal
                imageUrl={popupImage.url}
                label={popupImage.label}
                onClose={() => setPopupImage(null)}
              />
            )}
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  )
}

export default StandaloneOCREvaluation;
