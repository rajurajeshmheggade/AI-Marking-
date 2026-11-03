import type { ExtractionResult } from "@/lib/extraction"
import { cn } from "@/lib/utils"

interface ExtractionMetricsProps {
  result: ExtractionResult | null
}

export function ExtractionMetrics({ result }: ExtractionMetricsProps) {
  const tokens = result?.tokens ?? { input: 0, output: 0, thinking: 0, total: 0, calls: 0 }

  const cards = [
    { label: "Input tokens", value: tokens.input, highlight: false },
    { label: "Output tokens", value: tokens.output, highlight: false },
    { label: "Total tokens", value: tokens.total, highlight: true },
  ]

  return (
    <div className="grid grid-cols-3 gap-2">
      {cards.map((card) => (
        <div
          key={card.label}
          className={cn(
            "min-w-0 rounded-lg border px-3 py-2",
            card.highlight ? "border-teal-200 bg-teal-50" : "border-slate-200 bg-white"
          )}
        >
          <p className="truncate text-[11px] text-slate-500">{card.label}</p>
          <p
            className={cn(
              "text-base font-semibold tabular-nums",
              card.highlight ? "text-teal-700" : "text-slate-800"
            )}
          >
            {card.value.toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  )
}

export default ExtractionMetrics
