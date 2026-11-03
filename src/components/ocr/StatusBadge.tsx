import { Clock, CheckCircle, Loader2 } from "lucide-react"

export type PhaseStatus =
  | "yet-to-segmentation"
  | "yet-to-ocr"
  | "yet-to-evaluation"
  | "in-progress"
  | "completed"
  | "pending"
  | "approved"

interface StatusBadgeProps {
  status: string
  clickable?: boolean
  onClick?: () => void
}

export const StatusBadge = ({ status, clickable = false, onClick }: StatusBadgeProps) => {
  const config = {
    "yet-to-segmentation": {
      icon: Clock,
      label: "Yet to Segmentation",
      className: "bg-slate-50 text-slate-600 border-slate-200"
    },
    "yet-to-ocr": {
      icon: Clock,
      label: "Yet to OCR",
      className: "bg-slate-50 text-slate-600 border-slate-200"
    },
    "yet-to-evaluation": {
      icon: Clock,
      label: "Yet to Evaluate",
      className: "bg-slate-50 text-slate-600 border-slate-200"
    },
    "in-progress": {
      icon: Loader2,
      label: "In Progress",
      className: "bg-blue-50 text-blue-700 border-blue-200",
      animate: true
    },
    completed: {
      icon: CheckCircle,
      label: "Completed",
      className: "bg-emerald-50 text-emerald-700 border-emerald-200"
    },
    pending: {
      icon: Clock,
      label: "Pending",
      className: "bg-amber-50 text-amber-700 border-amber-200"
    },
    approved: {
      icon: CheckCircle,
      label: "Approved",
      className: "bg-teal-50 text-teal-700 border-teal-200"
    }
  }[status] || {
    icon: Clock,
    label: "Unknown",
    className: "bg-gray-50 text-gray-500 border-gray-200"
  }

  const Icon = config.icon

  return (
    <button
      type="button"
      onClick={clickable ? onClick : undefined}
      disabled={!clickable}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${config.className} ${
        clickable ? 'cursor-pointer hover:ring-2 hover:ring-teal-300 transition-all' : 'cursor-default'
      }`}
    >
      <Icon className={`w-3.5 h-3.5 ${config.animate ? 'animate-spin' : ''}`} />
      {config.label}
    </button>
  )
}

export default StatusBadge
