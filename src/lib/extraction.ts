/**
 * Master Agent — script extraction client.
 *
 * Mirrors the backend contract exactly (POST /aiapps/AITranscription/extract,
 * multipart form: subject, file, verify, interpret, line_mode, insertion_pass,
 * strict_maths, q_filter) and returns its response verbatim.
 */

export const ALLOWED_SUBJECTS = [
  "Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "English",
  "Social Science",
  "General",
] as const

export type Subject = (typeof ALLOWED_SUBJECTS)[number]

export const DEFAULT_ENDPOINT =
  `${import.meta.env.VITE_AIAPPS_API_BASE || 'https://ailevate-poc.excelsoftcorp.com/aiapps'}/AITranscription/extract`

export interface ExtractionOptions {
  verify: boolean
  interpret: boolean
  lineMode: boolean
  insertionPass: boolean
  strictMaths: boolean
  qFilter: string
}

export const DEFAULT_OPTIONS: ExtractionOptions = {
  verify: true,
  interpret: true,
  lineMode: true,
  insertionPass: true,
  strictMaths: false,
  qFilter: "",
}

export interface TokenUsage {
  input: number
  output: number
  thinking: number
  total: number
  calls: number
}

export interface ExtractionResult {
  subject: string
  blocks: string[]
  transcription: string
  transcription_latex: string
  interpretation: string
  issues: string[]
  insertions_placed: number
  figure_counts: { graph: number; diagram: number; table: number }
  tokens: TokenUsage
}

async function urlToFile(url: string): Promise<File> {
  const sameOriginPath = url.replace(/^https?:\/\/[^/]+/i, '')
  const candidates = sameOriginPath && sameOriginPath !== url ? [sameOriginPath, url] : [url]

  let lastError: unknown = null
  for (const candidate of candidates) {
    try {
      const res = await fetch(candidate)
      if (!res.ok) {
        lastError = new Error(`HTTP ${res.status}`)
        continue
      }
      const blob = await res.blob()
      if (blob.type && blob.type.startsWith("text/")) {
        lastError = new Error(`Unexpected content type ${blob.type}`)
        continue
      }
      const name = (url.split("/").pop() || "page").split("?")[0]
      return new File([blob], /\.(png|jpe?g|webp|tiff?)$/i.test(name) ? name : name + ".png", {
        type: blob.type || "image/png",
      })
    } catch (e) {
      lastError = e
    }
  }

  if (lastError instanceof TypeError) {
    throw new Error('The image host blocks cross-origin downloads (no Access-Control-Allow-Origin header). Please enable CORS on the backend or set up a reverse proxy on your frontend host.')
  }
  throw lastError instanceof Error ? lastError : new Error("Could not read the page image")
}

export interface RunExtractionParams {
  subject: string
  file?: File | null
  imageUrl?: string
  options: ExtractionOptions
  endpoint?: string
}

export async function runExtraction({
  subject,
  file,
  imageUrl,
  options,
  endpoint = DEFAULT_ENDPOINT,
}: RunExtractionParams): Promise<ExtractionResult> {
  const upload = file ?? (imageUrl ? await urlToFile(imageUrl) : null)
  if (!upload) throw new Error("No script page image to extract.")

  const form = new FormData()
  form.append("subject", subject)
  form.append("file", upload)
  form.append("verify", String(options.verify))
  form.append("interpret", String(options.interpret))
  form.append("line_mode", String(options.lineMode))
  form.append("insertion_pass", String(options.insertionPass))
  form.append("strict_maths", String(options.strictMaths))
  form.append("q_filter", options.qFilter || "")

  const res = await fetch(endpoint, { method: "POST", body: form })

  const contentType = res.headers.get("content-type") || ""
  const payload = contentType.includes("application/json")
    ? await res.json()
    : { detail: (await res.text()) || `HTTP ${res.status}: ${res.statusText}` }

  if (!res.ok) throw new Error(payload.detail || "Extraction request failed.")

  // The per-page fields (transcription, blocks, interpretation, ...) are nested
  // under a key named after the uploaded file, not at the top level - only
  // tokens and allowed_subjects sit beside it. Reading them off payload directly
  // silently fell back to every field's empty default, keeping just tokens
  // (which is top-level) and a subject that happened to echo the input.
  const NON_PAGE_KEYS = new Set(['tokens', 'allowed_subjects', 'detail'])
  const pageResult: any =
    (payload && typeof payload[upload.name] === 'object' && payload[upload.name])
    || (payload && typeof payload === 'object'
      ? Object.keys(payload)
        .filter(key => !NON_PAGE_KEYS.has(key) && payload[key] && typeof payload[key] === 'object' && !Array.isArray(payload[key]))
        .map(key => payload[key])[0]
      : null)
    || payload

  return {
    subject: pageResult.subject ?? subject,
    blocks: pageResult.blocks ?? [],
    transcription: pageResult.transcription ?? "",
    transcription_latex: pageResult.transcription_latex ?? "",
    interpretation: pageResult.interpretation ?? "",
    issues: pageResult.issues ?? [],
    insertions_placed: pageResult.insertions_placed ?? 0,
    figure_counts: pageResult.figure_counts ?? { graph: 0, diagram: 0, table: 0 },
    tokens: {
      input: payload.tokens?.input ?? 0,
      output: payload.tokens?.output ?? 0,
      thinking: payload.tokens?.thinking ?? 0,
      total: payload.tokens?.total ?? 0,
      calls: payload.tokens?.calls ?? 0,
    },
  }
}
