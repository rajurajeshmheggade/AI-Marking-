import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  LayoutDashboard, ScanLine, FileText, Combine, History, Settings,
  LogOut, Upload, X, Eye, Copy, Download, ChevronRight, ChevronLeft,
  Loader2, CheckCircle, AlertCircle, Sparkles, FileImage, FlaskConical,
  BarChart3, Clock, Zap, User, Maximize2, RotateCcw, Plus,
  BookOpen, Tag, XCircle, Check, ChevronDown, Menu, Beaker
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface UploadedImage {
  id: string
  file: File
  preview: string
  name: string
}

interface OcrResult {
  imageId: string
  imageName: string
  preview: string
  text: string
  time?: number
  tokens?: number
}

interface EvalResult {
  obtainedMarks: number
  totalMarks: number
  percentage: number
  feedback: string
  achievedPoints: string[]
  missingPoints: string[]
  tokens?: number
  time?: number
}

type ActiveMode = 'home' | 'ocr' | 'evaluation' | 'ocr-eval'
type StepStatus = 'idle' | 'running' | 'done' | 'error'

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const getSandboxUser = () => ({
  username: sessionStorage.getItem('sandboxUsername') || 'rajesh',
  displayName: sessionStorage.getItem('sandboxDisplayName') || 'Rajesh',
})

const toBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
  })

// ─────────────────────────────────────────────────────────────────────────────
// MOCK ENGINE — simulates backend responses with realistic dummy data
// Replace with real fetch() calls once backend is ready.
// ─────────────────────────────────────────────────────────────────────────────
export const MOCK_MODE = true

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// Pool of realistic OCR text samples — rotated per image
const OCR_SAMPLES = [
  `Question 1

The process of photosynthesis involves the conversion of light energy into chemical energy stored in glucose. This occurs in two main stages: the light-dependent reactions and the Calvin cycle.

In the light-dependent reactions, chlorophyll absorbs sunlight and uses this energy to split water molecules, releasing oxygen as a by-product and producing ATP and NADPH.

The Calvin cycle uses the ATP and NADPH produced in the first stage to fix carbon dioxide from the atmosphere into organic molecules, ultimately producing glucose which the plant uses for energy and growth.`,

  `Question 2

Newton's Second Law of Motion states that the acceleration of an object is directly proportional to the net force acting on it and inversely proportional to its mass.

Mathematically: F = ma, where F is force (in Newtons), m is mass (in kilograms), and a is acceleration (in m/s²).

For example, if a 5 kg object is accelerated at 3 m/s², the force required = 5 × 3 = 15 N.

This law explains why heavier objects require more force to accelerate at the same rate as lighter objects.`,

  `Question 3

The water cycle, also known as the hydrological cycle, describes the continuous movement of water on, above, and below the surface of the Earth.

Key stages include:
- Evaporation: Water from oceans, lakes, and rivers evaporates due to solar energy
- Condensation: Water vapour rises and cools to form clouds
- Precipitation: Water falls as rain, snow, sleet, or hail
- Collection: Water collects in oceans, rivers, and groundwater systems

This cycle is essential for distributing fresh water across the planet and regulating climate.`,

  `Question 4

The French Revolution (1789–1799) was a period of radical political and societal transformation in France. Driven by Enlightenment ideals, financial crisis, and social inequality, it led to the overthrow of the monarchy.

Key events:
- Storming of the Bastille (July 14, 1789)
- Declaration of the Rights of Man and Citizen
- Execution of King Louis XVI (1793)
- The Reign of Terror under Robespierre

The revolution ended with Napoleon Bonaparte's rise to power and fundamentally changed European political thought.`,

  `Question 5

DNA (Deoxyribonucleic Acid) is a double-helix molecule that carries the genetic instructions for the development, functioning, growth, and reproduction of all known organisms.

Structure: DNA consists of two strands wound around each other, made up of nucleotides. Each nucleotide contains a phosphate group, a deoxyribose sugar, and one of four nitrogenous bases: Adenine (A), Thymine (T), Guanine (G), and Cytosine (C).

Base pairing rule: A pairs with T, G pairs with C.

The sequence of these bases encodes genetic information that is passed from parent to offspring through reproduction.`,
]

const EVAL_ACHIEVED_POOL = [
  'Correctly identified the main concept',
  'Provided relevant examples',
  'Used appropriate scientific terminology',
  'Logical structure and coherent argument',
  'Accurate use of formulae/equations',
  'Mentioned key stages in correct order',
  'Addressed all sub-parts of the question',
  'Good use of supporting evidence',
]

const EVAL_MISSING_POOL = [
  'Did not explain the underlying mechanism',
  'Missing unit conversions',
  'No reference to real-world application',
  'Incomplete comparison between concepts',
  'Lacked concluding summary',
  'Missed mention of exceptions or limitations',
]

const EVAL_FEEDBACKS = [
  'The answer demonstrates a solid understanding of the core concepts. The explanation is well-structured and covers most of the key points expected. However, a more detailed discussion of the mechanisms and real-world applications would strengthen the response.',
  'Good attempt overall. The candidate correctly identified the main principles and provided relevant examples. The answer would benefit from more precise use of technical vocabulary and a clearer conclusion.',
  'The response shows a reasonable grasp of the topic, with accurate facts stated. To improve, the candidate should elaborate on the relationship between the sub-components and provide a more thorough analysis.',
  'An excellent response that addresses all major aspects of the question. The candidate has demonstrated strong command of the subject matter with clear and concise explanations.',
]

const pickRandom = <T,>(arr: T[], count: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

// Mock OCR — returns per-image OCR text
const mockRunOcr = async (
  images: { id: string; name: string; preview: string }[],
  questionNumber: string | null,
  username: string
): Promise<OcrResult[]> => {
  // Log payload shape to console for API reference
  console.log('[MOCK OCR] Payload:', { username, question_number: questionNumber, images: images.map(i => ({ filename: i.name, data: '(base64...)' })) })
  // Simulate network + processing delay (1.5–2.5s)
  await sleep(1500 + Math.random() * 1000)
  return images.map((img, idx) => ({
    imageId: img.id,
    imageName: img.name,
    preview: img.preview,
    text: OCR_SAMPLES[idx % OCR_SAMPLES.length],
    tokens: Math.floor(350 + Math.random() * 400),
    time: parseFloat((0.8 + Math.random() * 1.2).toFixed(2)),
  }))
}

// Mock Evaluation
const mockRunEval = async (ocrData: string, rubricFile: string, username: string): Promise<EvalResult> => {
  console.log('[MOCK EVAL] Payload:', { username, ocr_data: ocrData.slice(0, 80) + '...', rubric_md_file: rubricFile.slice(0, 40) + '...' })
  await sleep(2000 + Math.random() * 1000)
  const obtained = Math.floor(12 + Math.random() * 8)
  const total = 20
  return {
    obtainedMarks: obtained,
    totalMarks: total,
    percentage: Math.round((obtained / total) * 100),
    feedback: EVAL_FEEDBACKS[Math.floor(Math.random() * EVAL_FEEDBACKS.length)],
    achievedPoints: pickRandom(EVAL_ACHIEVED_POOL, Math.floor(3 + Math.random() * 3)),
    missingPoints: pickRandom(EVAL_MISSING_POOL, Math.floor(1 + Math.random() * 3)),
    tokens: Math.floor(1200 + Math.random() * 800),
    time: parseFloat((1.8 + Math.random() * 1.5).toFixed(2)),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/** Animated shimmer skeleton */
const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`relative overflow-hidden rounded bg-gray-100 ${className}`}>
    <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
  </div>
)

/** Image preview modal */
const ImageModal: React.FC<{ src: string; name: string; onClose: () => void }> = ({ src, name, onClose }) => (
  <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
    <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
      <button onClick={onClose} className="absolute top-3 right-3 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors">
        <X className="w-4 h-4" />
      </button>
      <img src={src} alt={name} className="max-w-full max-h-[85vh] object-contain bg-white" />
      <div className="bg-black/80 text-white text-xs px-4 py-2 text-center">{name}</div>
    </div>
  </div>
)

/** Full screen page loader */
const FullScreenLoader = ({ message }: { message: string }) => (
  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/60 backdrop-blur-sm animate-fade-in">
    <div className="flex flex-col items-center gap-6 p-10 rounded-[2rem] bg-white shadow-[0_0_50px_rgba(0,0,0,0.1)] border border-primary/10">
      <div className="relative flex items-center justify-center w-24 h-24">
        <div className="absolute inset-0 rounded-full border-t-4 border-primary/80 animate-spin" />
        <div className="absolute inset-3 rounded-full border-r-4 border-purple-500/80 animate-[spin_1.5s_linear_infinite]" />
        <div className="absolute inset-6 rounded-full border-b-4 border-emerald-500/80 animate-[spin_2s_linear_infinite]" />
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
      <div className="space-y-3 text-center max-w-xs">
        <h3 className="text-2xl font-bold bg-gradient-to-r from-primary via-purple-500 to-emerald-500 bg-clip-text text-transparent">{message}</h3>
        <p className="text-sm text-muted-foreground animate-pulse">Please wait while the AI processes your request...</p>
      </div>
    </div>
  </div>
)

/** Drag-and-drop image upload zone */
const ImageUploadZone: React.FC<{
  images: UploadedImage[]
  onAdd: (files: File[]) => void
  onRemove: (id: string) => void
  onPreview: (img: UploadedImage) => void
}> = ({ images, onAdd, onRemove, onPreview }) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const accept = ['image/png', 'image/jpeg', 'image/webp']

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    const valid = Array.from(files).filter(f => accept.includes(f.type))
    if (valid.length < (files?.length ?? 0)) toast.warning('Some files were skipped (only PNG/JPG/JPEG/WEBP allowed)')
    onAdd(valid)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    handleFiles(e.dataTransfer.files)
  }, [])

  return (
    <div className="space-y-4">
      <input ref={inputRef} type="file" multiple accept=".png,.jpg,.jpeg,.webp" className="hidden"
        onChange={e => handleFiles(e.target.files)} />

      {/* Drop zone */}
      {images.length === 0 && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`relative cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-300 p-10 text-center select-none
            ${dragging
              ? 'border-primary bg-primary/5 scale-[1.01] shadow-lg shadow-primary/10'
              : 'border-border hover:border-primary/50 hover:bg-primary/3 bg-gray-50/50'
            }`}
        >
          <div className="flex flex-col items-center gap-3">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300
              ${dragging ? 'bg-primary text-white scale-110' : 'bg-primary/10 text-primary'}`}>
              <Upload className="w-7 h-7" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">
                {dragging ? 'Drop images here' : 'Drag & Drop Images Here'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">or <span className="text-primary font-medium underline-offset-2 hover:underline">Browse Images</span></p>
            </div>
            <div className="flex gap-2 mt-1">
              {['PNG', 'JPG', 'JPEG', 'WEBP'].map(ext => (
                <span key={ext} className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">{ext}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Thumbnails */}
      {images.length > 0 && (
        <div className="space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">{images.length} image{images.length > 1 ? 's' : ''} selected</p>
            <button onClick={() => inputRef.current?.click()} className="text-sm font-medium text-primary hover:text-primary/80 flex items-center gap-1.5 bg-primary/10 px-3 py-1.5 rounded-lg transition-colors">
              <Upload className="w-4 h-4" /> Add More
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {images.map(img => (
              <div key={img.id} className="group relative rounded-xl overflow-hidden border border-border bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 animate-in zoom-in-95">
                <img src={img.preview} alt={img.name} className="w-full h-28 object-cover" />
                <div className="px-2 py-1.5">
                  <p className="text-[11px] text-muted-foreground truncate">{img.name}</p>
                </div>
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button onClick={() => onPreview(img)}
                    className="bg-white/20 hover:bg-white/30 text-white rounded-lg p-1.5 backdrop-blur-sm transition-colors" title="Preview">
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => onRemove(img.id)}
                    className="bg-red-500/70 hover:bg-red-500/90 text-white rounded-lg p-1.5 backdrop-blur-sm transition-colors" title="Remove">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** Rubric .md file upload */
const RubricUpload: React.FC<{ file: File | null; onUpload: (f: File) => void; onRemove: () => void }> = ({ file, onUpload, onRemove }) => {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-2">
        <BookOpen className="inline w-4 h-4 mr-1.5 text-primary" />
        Upload Rubric <span className="text-muted-foreground font-normal">(.md file)</span>
      </label>
      {!file ? (
        <div onClick={() => inputRef.current?.click()}
          className="cursor-pointer border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/3 rounded-xl p-6 flex items-center gap-4 transition-all duration-200">
          <input ref={inputRef} type="file" accept=".md" className="hidden" onChange={e => { if (e.target.files?.[0]) onUpload(e.target.files[0]) }} />
          <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
            <FileText className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Click to upload Markdown rubric</p>
            <p className="text-xs text-muted-foreground mt-0.5">Accepts .md files only</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-purple-50 border border-purple-200">
          <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-purple-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-purple-900 truncate">{file.name}</p>
            <p className="text-xs text-purple-600">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
          <button onClick={onRemove} className="text-purple-400 hover:text-purple-600 transition-colors">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  )
}

/** Evaluation result card */
const EvalResultCard: React.FC<{ result: EvalResult }> = ({ result }) => {
  const pct = result.percentage
  const color = pct >= 70 ? 'text-green-600' : pct >= 40 ? 'text-yellow-600' : 'text-red-500'
  const bgColor = pct >= 70 ? 'bg-green-50 border-green-200' : pct >= 40 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'

  const copyResult = () => {
    const text = `Obtained: ${result.obtainedMarks}/${result.totalMarks} (${result.percentage}%)\n\nFeedback:\n${result.feedback}\n\nAchieved:\n${result.achievedPoints.join('\n')}\n\nMissing:\n${result.missingPoints.join('\n')}`
    navigator.clipboard.writeText(text)
    toast.success('Result copied to clipboard')
  }

  const downloadResult = () => {
    const text = `AI Evaluation Testing Sandbox — Evaluation Report\n${'='.repeat(50)}\n\nObtained Marks: ${result.obtainedMarks} / ${result.totalMarks}\nPercentage: ${result.percentage}%\n\nFeedback:\n${result.feedback}\n\nKey Points Achieved:\n${result.achievedPoints.map(p => `  ✔ ${p}`).join('\n')}\n\nMissing Points:\n${result.missingPoints.map(p => `  ✘ ${p}`).join('\n')}\n\nTokens Used: ${result.tokens ?? '—'}\nEvaluation Time: ${result.time ? result.time.toFixed(2) + 's' : '—'}\n`
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'evaluation-report.txt'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="animate-fade-in space-y-5 mt-4">
      {/* Score banner */}
      <div className={`rounded-2xl border p-6 ${bgColor}`}>
        <div className="flex flex-wrap gap-8 items-center justify-between">
          <div className="text-center">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Obtained</p>
            <p className={`text-4xl font-black mt-1 ${color}`}>{result.obtainedMarks}</p>
          </div>
          <div className="text-center">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Total</p>
            <p className="text-4xl font-black mt-1 text-foreground">{result.totalMarks}</p>
          </div>
          <div className="text-center">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Percentage</p>
            <p className={`text-4xl font-black mt-1 ${color}`}>{result.percentage}%</p>
          </div>
          <div className="flex-1 min-w-[160px]">
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-1000 ${pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                style={{ width: `${pct}%` }} />
            </div>
            <p className={`text-xs font-semibold mt-1.5 text-right ${color}`}>{pct >= 70 ? 'Pass' : pct >= 40 ? 'Below Average' : 'Fail'}</p>
          </div>
        </div>
      </div>

      {/* Feedback */}
      {result.feedback && (
        <div className="bg-white rounded-xl border border-border p-4">
          <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
            <MessageSquareIcon className="w-4 h-4 text-primary" /> Feedback
          </p>
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{result.feedback}</p>
        </div>
      )}

      {/* Tags */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {result.achievedPoints.length > 0 && (
          <div className="bg-green-50 rounded-xl border border-green-200 p-4">
            <p className="text-xs font-semibold text-green-700 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" /> Key Points Achieved
            </p>
            <div className="flex flex-wrap gap-2">
              {result.achievedPoints.map((pt, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-800 rounded-full px-3 py-1 border border-green-200">
                  <Check className="w-3 h-3" /> {pt}
                </span>
              ))}
            </div>
          </div>
        )}
        {result.missingPoints.length > 0 && (
          <div className="bg-red-50 rounded-xl border border-red-200 p-4">
            <p className="text-xs font-semibold text-red-700 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <X className="w-3.5 h-3.5" /> Missing Points
            </p>
            <div className="flex flex-wrap gap-2">
              {result.missingPoints.map((pt, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-800 rounded-full px-3 py-1 border border-red-200">
                  <X className="w-3 h-3" /> {pt}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Meta + Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex gap-4 text-sm text-muted-foreground">
          {result.tokens != null && (
            <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-yellow-500" /> {result.tokens.toLocaleString()} tokens</span>
          )}
          {result.time != null && (
            <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-blue-500" /> {result.time.toFixed(2)}s</span>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={copyResult}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-all duration-200 text-muted-foreground hover:text-primary">
            <Copy className="w-3.5 h-3.5" /> Copy Result
          </button>
          <button onClick={downloadResult}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary/90 transition-all duration-200">
            <Download className="w-3.5 h-3.5" /> Download Report
          </button>
        </div>
      </div>
    </div>
  )
}

// Simple inline icon since we can't import MessageSquare naming conflict
const MessageSquareIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </svg>
)

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const SandboxDashboard: React.FC = () => {
  const navigate = useNavigate()
  const user = getSandboxUser()

  // ── Guard ──
  useEffect(() => {
    if (sessionStorage.getItem('sandboxLogin') !== 'true') {
      navigate('/login', { replace: true })
    }
  }, [navigate])

  // ── Layout state ──
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activeMode, setActiveMode] = useState<ActiveMode>('home')

  // ── Shared states ──
  const [previewImg, setPreviewImg] = useState<{ src: string; name: string } | null>(null)

  // ── OCR state ──
  const [ocrImages, setOcrImages] = useState<UploadedImage[]>([])
  const [ocrQuestion, setOcrQuestion] = useState('')
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrResults, setOcrResults] = useState<OcrResult[]>([])
  const [ocrTotalTime, setOcrTotalTime] = useState<number | null>(null)
  const [ocrTotalTokens, setOcrTotalTokens] = useState<number | null>(null)

  // ── Evaluation state ──
  const [evalOcrText, setEvalOcrText] = useState('')
  const [evalRubric, setEvalRubric] = useState<File | null>(null)
  const [evalLoading, setEvalLoading] = useState(false)
  const [evalResult, setEvalResult] = useState<EvalResult | null>(null)

  // ── OCR+Eval state ──
  const [comboImages, setComboImages] = useState<UploadedImage[]>([])
  const [comboRubric, setComboRubric] = useState<File | null>(null)
  const [comboQuestion, setComboQuestion] = useState('')
  const [comboLoading, setComboLoading] = useState(false)
  const [comboOcrStep, setComboOcrStep] = useState<StepStatus>('idle')
  const [comboEvalStep, setComboEvalStep] = useState<StepStatus>('idle')
  const [comboOcrResults, setComboOcrResults] = useState<OcrResult[]>([])
  const [comboEvalResult, setComboEvalResult] = useState<EvalResult | null>(null)

  // ─── Image helpers ───
  const makeImgObj = async (file: File): Promise<UploadedImage> => ({
    id: `${Date.now()}-${Math.random()}`,
    file,
    preview: await toBase64(file),
    name: file.name,
  })

  const addImages = async (setter: React.Dispatch<React.SetStateAction<UploadedImage[]>>, files: File[]) => {
    const objs = await Promise.all(files.map(makeImgObj))
    setter(prev => [...prev, ...objs])
  }

  const removeImage = (setter: React.Dispatch<React.SetStateAction<UploadedImage[]>>, id: string) =>
    setter(prev => prev.filter(i => i.id !== id))

  // ─────────────────────────────────────────────────────
  // OCR RUN — MOCK
  // ─────────────────────────────────────────────────────
  const runOcr = async () => {
    if (ocrImages.length === 0) { toast.error('Please upload at least one image'); return }
    setOcrLoading(true); setOcrResults([]); setOcrTotalTime(null); setOcrTotalTokens(null)
    const start = Date.now()
    try {
      const results = await mockRunOcr(
        ocrImages.map(img => ({ id: img.id, name: img.name, preview: img.preview })),
        ocrQuestion.trim() || null,
        user.username
      )
      setOcrResults(results)
      setOcrTotalTime((Date.now() - start) / 1000)
      setOcrTotalTokens(results.reduce((s, r) => s + (r.tokens ?? 0), 0))
      toast.success('OCR completed — Mock data returned')
    } catch (err: any) {
      toast.error(err.message || 'OCR failed')
    } finally {
      setOcrLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────
  // EVALUATION RUN — MOCK
  // ─────────────────────────────────────────────────────
  const runEval = async () => {
    if (!evalOcrText.trim()) { toast.error('Please paste OCR text'); return }
    if (!evalRubric) { toast.error('Please upload a rubric file'); return }
    setEvalLoading(true); setEvalResult(null)
    try {
      const rubricText = await evalRubric.text()
      const result = await mockRunEval(evalOcrText.trim(), rubricText, user.username)
      setEvalResult(result)
      toast.success('Evaluation completed — Mock data returned')
    } catch (err: any) {
      toast.error(err.message || 'Evaluation failed')
    } finally {
      setEvalLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────
  // OCR + EVAL COMBINED RUN — MOCK
  // ─────────────────────────────────────────────────────
  const runCombo = async () => {
    if (comboImages.length === 0) { toast.error('Please upload at least one image'); return }
    if (!comboRubric) { toast.error('Please upload a rubric file'); return }
    setComboLoading(true)
    setComboOcrStep('running'); setComboEvalStep('idle')
    setComboOcrResults([]); setComboEvalResult(null)
    try {
      // Step 1 — OCR
      const ocrResults = await mockRunOcr(
        comboImages.map(img => ({ id: img.id, name: img.name, preview: img.preview })),
        comboQuestion.trim() || null,
        user.username
      )
      setComboOcrStep('done')
      setComboOcrResults(ocrResults)

      // Brief UX pause before evaluation step
      await sleep(400)

      // Step 2 — Evaluation
      setComboEvalStep('running')
      const rubricText = await comboRubric.text()
      const combinedOcrText = ocrResults.map(r => r.text).join('\n\n')
      const evalRes = await mockRunEval(combinedOcrText, rubricText, user.username)
      setComboEvalStep('done')
      setComboEvalResult(evalRes)
      toast.success('OCR + Evaluation completed — Mock data returned')
    } catch (err: any) {
      setComboOcrStep(prev => prev === 'running' ? 'error' : prev)
      setComboEvalStep(prev => prev === 'running' ? 'error' : prev)
      toast.error(err.message || 'Pipeline failed')
    } finally {
      setComboLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────
  // LOGOUT
  // ─────────────────────────────────────────────────────
  const handleLogout = () => {
    sessionStorage.removeItem('sandboxLogin')
    sessionStorage.removeItem('sandboxUsername')
    sessionStorage.removeItem('sandboxDisplayName')
    navigate('/login', { replace: true })
  }

  // ─────────────────────────────────────────────────────
  // SIDEBAR NAV ITEMS
  // ─────────────────────────────────────────────────────
  const navItems = [
    { id: 'ocr', label: 'OCR', icon: ScanLine, future: false },
    { id: 'evaluation', label: 'Evaluation', icon: FileText, future: false },
    { id: 'ocr-eval', label: 'OCR + Evaluation', icon: Combine, future: false },
  ] as const

  // ─────────────────────────────────────────────────────
  // COPY / DOWNLOAD OCR helpers
  // ─────────────────────────────────────────────────────
  const copyAllOcr = (results: OcrResult[]) => {
    navigator.clipboard.writeText(results.map(r => `=== ${r.imageName} ===\n${r.text}`).join('\n\n'))
    toast.success('All OCR text copied')
  }

  const downloadAllOcr = (results: OcrResult[]) => {
    const text = results.map(r => `=== ${r.imageName} ===\n${r.text}`).join('\n\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'ocr-results.txt'; a.click()
    URL.revokeObjectURL(url)
  }

  // ─────────────────────────────────────────────────────
  // OCR SPLIT SCREEN
  // ─────────────────────────────────────────────────────
  const renderOcrOutput = (images: UploadedImage[], results: OcrResult[], loading: boolean, totalTime: number | null, totalTokens: number | null) => {
    if (loading) return (
      <div className="space-y-4 mt-6">
        {[1, 2].map(i => (
          <div key={i} className="grid grid-cols-2 gap-4">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        ))}
      </div>
    )
    if (results.length === 0) return null
    return (
      <div className="mt-6 space-y-4 animate-fade-in">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">OCR Results</h3>
          <div className="flex gap-2">
            <button onClick={() => copyAllOcr(results)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-muted-foreground hover:text-primary">
              <Copy className="w-3.5 h-3.5" /> Copy All
            </button>
            <button onClick={() => downloadAllOcr(results)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary/90 transition-all">
              <Download className="w-3.5 h-3.5" /> Download OCR
            </button>
          </div>
        </div>
        {results.map((r, idx) => (
          <div key={r.imageId} className="border border-border rounded-2xl overflow-hidden bg-white shadow-sm">
            <div className="bg-gray-50 px-4 py-2.5 border-b border-border flex items-center gap-2">
              <FileImage className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Image {idx + 1} — {r.imageName}</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border">
              {/* Left: Image */}
              <div className="p-4 flex flex-col items-center gap-3">
                <div className="relative group w-full">
                  <img src={r.preview} alt={r.imageName} className="w-full max-h-64 object-contain rounded-xl border border-border" />
                  <button onClick={() => setPreviewImg({ src: r.preview, name: r.imageName })}
                    className="absolute top-2 right-2 bg-black/40 hover:bg-black/60 text-white rounded-lg p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {/* Right: OCR Text */}
              <div className="p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">OCR Output</p>
                  <button onClick={() => { navigator.clipboard.writeText(r.text); toast.success('Copied') }}
                    className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors">
                    <Copy className="w-3 h-3" /> Copy
                  </button>
                </div>
                <div className="flex-1 bg-gray-50 rounded-xl border border-border p-4 min-h-[140px] max-h-64 overflow-y-auto">
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap font-[inherit]">{r.text}</p>
                </div>
                {(r.tokens || r.time) && (
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    {r.tokens && <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-yellow-500" />{r.tokens} tokens</span>}
                    {r.time && <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-blue-500" />{r.time.toFixed(2)}s</span>}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {/* Summary bar */}
        <div className="flex flex-wrap gap-4 items-center justify-between p-4 bg-primary/5 rounded-2xl border border-primary/15">
          <div className="flex flex-wrap gap-5 text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground"><FileImage className="w-4 h-4 text-primary" /> {results.length} images</span>
            {totalTime != null && <span className="flex items-center gap-1.5 text-muted-foreground"><Clock className="w-4 h-4 text-blue-500" /> {totalTime.toFixed(2)}s total</span>}
            {totalTokens != null && <span className="flex items-center gap-1.5 text-muted-foreground"><Zap className="w-4 h-4 text-yellow-500" /> {totalTokens.toLocaleString()} tokens</span>}
          </div>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────
  // STEP INDICATOR (for OCR+Eval)
  // ─────────────────────────────────────────────────────
  const StepIndicator: React.FC<{ label: string; status: StepStatus }> = ({ label, status }) => {
    const icons = {
      idle: <div className="w-5 h-5 rounded-full border-2 border-gray-300" />,
      running: <Loader2 className="w-5 h-5 text-primary animate-spin" />,
      done: <CheckCircle className="w-5 h-5 text-green-500" />,
      error: <AlertCircle className="w-5 h-5 text-red-500" />,
    }
    const colors = {
      idle: 'text-muted-foreground',
      running: 'text-primary font-semibold',
      done: 'text-green-600 font-semibold',
      error: 'text-red-500 font-semibold',
    }
    return (
      <div className="flex items-center gap-2">
        {icons[status]}
        <span className={`text-sm ${colors[status]}`}>{label}</span>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════
  // PANELS
  // ═══════════════════════════════════════════════════════════

  // ── HOME ──
  const HomePannel = () => {
    const cards = [
      {
  id: 'ocr' as ActiveMode,
  icon: ScanLine,
  color: 'blue',
  title: 'OCR',
  desc: 'Upload one or more images to extract high-accuracy text using the AI-powered OCR engine. Review, edit, and copy the extracted content before further processing.',
  gradient: 'from-blue-500 to-cyan-500',
  bg: 'bg-blue-50 border-blue-200 hover:border-blue-400',
  iconBg: 'bg-blue-100',
  iconColor: 'text-blue-600',
},
{
  id: 'evaluation' as ActiveMode,
  icon: FileText,
  color: 'purple',
  title: 'Evaluation',
  desc: 'Evaluate OCR or manually entered text against a selected rubric to generate scores, detailed feedback, and criterion-based assessment.',
  gradient: 'from-purple-500 to-violet-500',
  bg: 'bg-purple-50 border-purple-200 hover:border-purple-400',
  iconBg: 'bg-purple-100',
  iconColor: 'text-purple-600',
},
{
  id: 'ocr-eval' as ActiveMode,
  icon: Combine,
  color: 'green',
  title: 'OCR + Evaluation',
  desc: 'Run the complete workflow by uploading answer sheet images and a rubric. The system performs OCR, evaluates the extracted content, and generates the final assessment in a single process.',
  gradient: 'from-emerald-500 to-teal-500',
  bg: 'bg-emerald-50 border-emerald-200 hover:border-emerald-400',
  iconBg: 'bg-emerald-100',
  iconColor: 'text-emerald-600',
},
    ]
    return (
      <div className="animate-fade-in">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground">Evaluation Workbench</h2>
          <p className="text-muted-foreground mt-1">Choose a processing pipeline to begin. Select the mode that best matches your document processing and evaluation workflow.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cards.map(c => (
            <button key={c.id} onClick={() => setActiveMode(c.id)}
              className={`text-left group relative rounded-2xl border-2 ${c.bg} p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl overflow-hidden`}>
              <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${c.gradient} opacity-0 group-hover:opacity-100 transition-opacity`} />
              <div className={`w-14 h-14 rounded-2xl ${c.iconBg} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}>
                <c.icon className={`w-7 h-7 ${c.iconColor}`} />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">{c.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{c.desc}</p>
              <div className="mt-4 flex items-center gap-1 text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                Get Started <ChevronRight className="w-4 h-4" />
              </div>
            </button>
          ))}
        </div>

       
      </div>
    )
  }

  // ── OCR PANEL ──
  const OcrPanel = () => (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
          <ScanLine className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">OCR</h2>
          <p className="text-sm text-muted-foreground">Extract text from images</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-border shadow-sm p-6 space-y-6">
        <ImageUploadZone
          images={ocrImages}
          onAdd={files => addImages(setOcrImages, files)}
          onRemove={id => removeImage(setOcrImages, id)}
          onPreview={img => setPreviewImg({ src: img.preview, name: img.name })}
        />

        {/* Question number */}
        <div className="max-w-xs space-y-1.5">
          <label className="text-sm font-medium text-foreground">
            Question Number <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <Input
            placeholder="e.g. Question 1 or 1"
            value={ocrQuestion}
            onChange={e => setOcrQuestion(e.target.value)}
            className="ai-input"
          />
          <p className="text-xs text-muted-foreground">Leave empty to OCR all images without filtering</p>
        </div>

        {/* Run button */}
        <div className="flex justify-end">
          <button
            onClick={runOcr}
            disabled={ocrLoading || ocrImages.length === 0}
            className="ai-button-primary w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-3 rounded-xl font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {ocrLoading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Running OCR...</>
            ) : (
              <><ScanLine className="w-4 h-4" /> Run OCR</>
            )}
          </button>
        </div>
      </div>

      {/* OCR output */}
      {renderOcrOutput(ocrImages, ocrResults, ocrLoading, ocrTotalTime, ocrTotalTokens)}
    </div>
  )

  // ── EVALUATION PANEL ──
  const EvaluationPanel = () => (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
          <FileText className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Evaluation</h2>
          <p className="text-sm text-muted-foreground">Paste OCR text and upload a rubric to evaluate with AI</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-border shadow-sm p-6 space-y-6">
        {/* OCR text input */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">OCR Text <span className="text-red-500">*</span></label>
          <Textarea
            placeholder="Paste OCR output here..."
            value={evalOcrText}
            onChange={e => setEvalOcrText(e.target.value)}
            rows={10}
            spellCheck={false}
            className="font-mono text-sm resize-none ai-input leading-relaxed"
          />
          <p className="text-xs text-muted-foreground">{evalOcrText.length} characters</p>
        </div>

        {/* Rubric upload */}
        <RubricUpload file={evalRubric} onUpload={setEvalRubric} onRemove={() => setEvalRubric(null)} />

        {/* Evaluate button */}
        <div className="flex justify-end">
          <button
            onClick={runEval}
            disabled={evalLoading || !evalOcrText.trim() || !evalRubric}
            className="ai-button-primary w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-3 rounded-xl font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {evalLoading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Evaluating...</>
            ) : (
              <><Sparkles className="w-4 h-4" /> Evaluate</>
            )}
          </button>
        </div>
      </div>

      {/* Loading skeleton */}
      {evalLoading && (
        <div className="space-y-4">
          <Skeleton className="h-32" />
          <div className="grid grid-cols-2 gap-4"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
        </div>
      )}

      {/* Result */}
      {evalResult && !evalLoading && (
        <div className="bg-white rounded-2xl border border-border shadow-sm p-6">
          <h3 className="text-base font-semibold text-foreground mb-1 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" /> Evaluation Result
          </h3>
          <EvalResultCard result={evalResult} />
        </div>
      )}
    </div>
  )

  // ── OCR + EVAL PANEL ──
  const ComboPanel = () => (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
          <Combine className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">OCR + Evaluation</h2>
          <p className="text-sm text-muted-foreground">End-to-end pipeline — OCR followed by AI evaluation</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-border shadow-sm p-6 space-y-6">
        <ImageUploadZone
          images={comboImages}
          onAdd={files => addImages(setComboImages, files)}
          onRemove={id => removeImage(setComboImages, id)}
          onPreview={img => setPreviewImg({ src: img.preview, name: img.name })}
        />

        <RubricUpload file={comboRubric} onUpload={setComboRubric} onRemove={() => setComboRubric(null)} />

        {/* Question number */}
        <div className="max-w-xs space-y-1.5">
          <label className="text-sm font-medium text-foreground">
            Question Number <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <Input
            placeholder="e.g. Question 1 or 1"
            value={comboQuestion}
            onChange={e => setComboQuestion(e.target.value)}
            className="ai-input"
          />
        </div>

        {/* Progress steps */}
        {(comboLoading || comboOcrStep !== 'idle') && (
          <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 border border-border">
            <StepIndicator label="Step 1 — OCR" status={comboOcrStep} />
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
            <StepIndicator label="Step 2 — Evaluation" status={comboEvalStep} />
          </div>
        )}

        {/* Run button */}
        <div className="flex justify-end">
          <button
            onClick={runCombo}
            disabled={comboLoading || comboImages.length === 0 || !comboRubric}
            className="ai-button-primary w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-3 rounded-xl font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {comboLoading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
            ) : (
              <><Combine className="w-4 h-4" /> Run Complete Evaluation</>
            )}
          </button>
        </div>
      </div>

      {/* OCR Results */}
      {comboOcrResults.length > 0 && renderOcrOutput(comboImages, comboOcrResults, false, null, null)}

      {/* Eval Result */}
      {comboEvalResult && !comboLoading && (
        <div className="bg-white rounded-2xl border border-border shadow-sm p-6 mt-4 animate-fade-in">
          <h3 className="text-base font-semibold text-foreground mb-1 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" /> Evaluation Result
          </h3>
          <EvalResultCard result={comboEvalResult} />
        </div>
      )}
    </div>
  )

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════

  const loaderMessage = ocrLoading 
    ? 'Running OCR Engine...' 
    : evalLoading 
      ? 'Evaluating with AI Rubric...' 
      : comboLoading 
        ? 'Processing End-to-End Pipeline...' 
        : null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {loaderMessage && <FullScreenLoader message={loaderMessage} />}

      {/* IMAGE PREVIEW MODAL */}
      {previewImg && <ImageModal src={previewImg.src} name={previewImg.name} onClose={() => setPreviewImg(null)} />}

      <div className="flex flex-1 overflow-hidden">

        {/* ── MAIN ── */}
        <div className="flex-1 flex flex-col transition-all duration-300">

          {/* HEADER */}
          <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xl border-b border-border/20 shadow-sm px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <img src="/lovable-uploads/b5b0f5a8-9552-4635-8c44-d5e6f994179c.png" alt="ICM Logo" className="h-8 w-auto flex-shrink-0" />
                <div className="flex flex-col">
                  <h1 className="text-lg font-bold text-foreground leading-tight">
                    OCR Evaluation
                  </h1>
                  <p className="text-xs text-muted-foreground font-medium">
                    AI powered Essay Marking
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {/* Mode Selector */}
              <div className="hidden sm:block mr-2">
                <select 
                  value={activeMode} 
                  onChange={(e) => setActiveMode(e.target.value as ActiveMode)}
                  className="bg-gray-50 border border-border text-sm rounded-lg focus:ring-primary focus:border-primary block w-56 p-2.5 text-foreground font-medium shadow-sm outline-none cursor-pointer transition-colors hover:bg-gray-100"
                >
                  <option value="home" disabled>Select Mode...</option>
                  {navItems.map(item => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
              </div>
              <button className="hidden sm:flex items-center gap-2 text-sm font-medium text-emerald-600 bg-white hover:bg-emerald-50 px-4 py-2 rounded-full border border-emerald-200 transition-colors shadow-sm capitalize">
                <User className="w-4 h-4" /> {user.displayName}
              </button>
              <div className="hidden sm:flex items-center gap-2 text-sm font-medium text-purple-600 bg-white px-4 py-2 rounded-full border border-purple-200 shadow-sm">
                <Sparkles className="w-4 h-4 text-purple-500" /> 0 Tokens
              </div>
              <button onClick={handleLogout}
                className="hidden sm:flex items-center gap-2 text-sm font-medium text-foreground hover:text-red-600 px-2 py-2 rounded-lg transition-colors">
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </div>
          </header>

         

          {/* PAGE CONTENT */}
          <main className="flex-1 overflow-y-auto p-6 pb-20 flex flex-col items-center">
            <div className="w-full max-w-6xl">
              {activeMode === 'home' && <HomePannel />}
              {activeMode === 'ocr' && <OcrPanel />}
              {activeMode === 'evaluation' && <EvaluationPanel />}
              {activeMode === 'ocr-eval' && <ComboPanel />}
            </div>
          </main>

          {/* FOOTER */}
          <footer className="border-t border-border/20 bg-white/80 py-4 px-6 text-center text-xs text-muted-foreground">
            Copyright © 2026 | Excelsoft Technologies Ltd. | Version: V.1.0.0
          </footer>
        </div>
      </div>
    </div>
  )
}

export default SandboxDashboard
