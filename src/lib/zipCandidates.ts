/**
 * Candidate discovery for folder-level / image-level indexing.
 *
 * One uploaded ZIP holds a whole workspace's scripts. Three layouts are accepted,
 * and which one an archive uses is inferred from how deep its images sit:
 *
 *   images   Candidate001.jpg                      -> one candidate per image
 *   folders  Candidate001/page1.jpg                -> one candidate per folder
 *   wrapped  Uploaded/Candidate001/page1.jpg       -> as above, wrapper ignored
 *
 * Anything else - mixed depths, several wrapper folders, deeper nesting - is
 * ambiguous about who the candidate is, so it is refused rather than guessed at.
 *
 * Kept free of JSZip and React so it can be exercised directly in tests; callers
 * hand over a flat entry list.
 */

/** Image types the existing upload pipeline already accepts (ALLOWED_EXTENSIONS minus pdf). */
export const SUPPORTED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'bmp', 'webp', 'tiff'] as const

/** How deep an image may sit before the layout stops being one we recognise. */
export const MAX_CANDIDATE_DEPTH = 2

export type ZipEntry = { path: string; dir: boolean }

export type ZipCandidate = {
  /** Folder name, or the image's filename without extension. */
  name: string
  /** Entry paths inside the archive, in natural order. */
  imagePaths: string[]
}

export type ZipScanSuccess = {
  ok: true
  structure: 'images' | 'folders' | 'wrapped'
  /** Present only for 'wrapped'; it names the folder that was skipped over. */
  wrapperFolder?: string
  candidates: ZipCandidate[]
  imageCount: number
  /** Entries left out (unsupported types, macOS metadata, dotfiles). */
  ignoredEntries: string[]
}

export type ZipScanFailure = { ok: false; error: string }

export type ZipScanResult = ZipScanSuccess | ZipScanFailure

/**
 * The project compiles with strictNullChecks off, where narrowing a union on a
 * `false` discriminant is unreliable, so the failure branch is recognised through
 * this guard rather than a bare `!result.ok`.
 */
export const isZipScanFailure = (result: ZipScanResult): result is ZipScanFailure => !result.ok

const extensionOf = (fileName: string) => {
  const dot = fileName.lastIndexOf('.')
  return dot === -1 ? '' : fileName.slice(dot + 1).toLowerCase()
}

export const isSupportedImage = (fileName: string) =>
  (SUPPORTED_IMAGE_EXTENSIONS as readonly string[]).includes(extensionOf(fileName))

export const stripExtension = (fileName: string) => {
  const dot = fileName.lastIndexOf('.')
  return dot === -1 ? fileName : fileName.slice(0, dot)
}

/** Archive metadata that is never part of a candidate. */
const isNoiseSegment = (segment: string) => segment === '__MACOSX' || segment.startsWith('.')

/**
 * An entry that would escape the extraction directory, or is absolute. Rejected
 * outright rather than skipped, since a traversal attempt makes the whole archive
 * untrustworthy.
 */
const isUnsafePath = (path: string) =>
  path.split('/').some(segment => segment === '..') || /^([a-zA-Z]:)?[\\/]/.test(path)

const naturalSort = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })

export function scanZipEntries(entries: ZipEntry[]): ZipScanResult {
  const images: { segments: string[]; path: string }[] = []
  const ignoredEntries: string[] = []

  for (const entry of entries) {
    // Checked before any leading separator is stripped: stripping first would turn
    // an absolute entry into an innocent-looking relative one.
    const normalized = String(entry?.path ?? '').replace(/\\/g, '/')
    if (!normalized.trim()) continue

    if (isUnsafePath(normalized)) {
      return { ok: false, error: `The ZIP contains an unsafe path and was not processed: ${normalized}` }
    }

    const segments = normalized.replace(/^\/+/, '').split('/').filter(Boolean)
    if (entry.dir || segments.length === 0) continue
    if (segments.some(isNoiseSegment)) continue

    if (!isSupportedImage(segments[segments.length - 1])) {
      ignoredEntries.push(normalized)
      continue
    }
    images.push({ segments, path: normalized })
  }

  if (images.length === 0) {
    return {
      ok: false,
      error: `No supported images found in the ZIP. Accepted types: ${SUPPORTED_IMAGE_EXTENSIONS.join(', ').toUpperCase()}.`,
    }
  }

  const depths = new Set(images.map(image => image.segments.length - 1))
  const tooDeep = Math.max(...depths)
  if (tooDeep > MAX_CANDIDATE_DEPTH) {
    return {
      ok: false,
      error: `The ZIP nests images ${tooDeep} folders deep, which is too deep to tell which folder names the candidate. Use one folder per candidate, optionally inside a single parent folder.`,
    }
  }
  if (depths.size > 1) {
    const described = [...depths].sort().map(depth => (depth === 0 ? 'loose images' : `images ${depth} folder(s) deep`))
    return {
      ok: false,
      error: `The ZIP mixes ${described.join(' and ')}, so it is unclear which of them names a candidate. Use one layout for the whole ZIP.`,
    }
  }

  const depth = [...depths][0]
  if (depth === 0) return buildFromLooseImages(images, ignoredEntries)
  if (depth === 1) return buildFromFolders(images, ignoredEntries, 'folders')

  const wrappers = new Set(images.map(image => image.segments[0]))
  if (wrappers.size > 1) {
    return {
      ok: false,
      error: `The ZIP has ${wrappers.size} top-level folders each holding more folders. Only a single parent folder around the candidate folders is supported.`,
    }
  }
  return buildFromFolders(images, ignoredEntries, 'wrapped', [...wrappers][0])
}

/** Option B: every image at the root is its own candidate, named after the file. */
function buildFromLooseImages(
  images: { segments: string[]; path: string }[],
  ignoredEntries: string[]
): ZipScanResult {
  const byName = new Map<string, ZipCandidate>()

  for (const image of images) {
    const name = stripExtension(image.segments[0]).trim()
    if (!name) {
      return { ok: false, error: `An image in the ZIP has no filename to take a candidate name from: ${image.path}` }
    }
    const existing = byName.get(name.toLowerCase())
    if (existing) {
      // Candidate001.jpg beside Candidate001.png would silently collapse into one
      // candidate, so the clash is surfaced instead.
      return {
        ok: false,
        error: `Two images map to the same candidate "${name}" (${existing.imagePaths[0]} and ${image.path}). Rename one, or put each candidate's pages in their own folder.`,
      }
    }
    byName.set(name.toLowerCase(), { name, imagePaths: [image.path] })
  }

  return {
    ok: true,
    structure: 'images',
    candidates: [...byName.values()].sort((a, b) => naturalSort(a.name, b.name)),
    imageCount: images.length,
    ignoredEntries,
  }
}

/** Options A and C: the folder above the image names the candidate. */
function buildFromFolders(
  images: { segments: string[]; path: string }[],
  ignoredEntries: string[],
  structure: 'folders' | 'wrapped',
  wrapperFolder?: string
): ZipScanResult {
  const folderIndex = structure === 'wrapped' ? 1 : 0
  const byName = new Map<string, ZipCandidate>()

  for (const image of images) {
    const name = String(image.segments[folderIndex] ?? '').trim()
    if (!name) {
      return { ok: false, error: `A candidate folder in the ZIP has no name: ${image.path}` }
    }
    const key = name.toLowerCase()
    const existing = byName.get(key)
    if (existing) existing.imagePaths.push(image.path)
    else byName.set(key, { name, imagePaths: [image.path] })
  }

  const candidates = [...byName.values()]
    .map(candidate => ({ ...candidate, imagePaths: [...candidate.imagePaths].sort(naturalSort) }))
    .sort((a, b) => naturalSort(a.name, b.name))

  return {
    ok: true,
    structure,
    ...(wrapperFolder ? { wrapperFolder } : {}),
    candidates,
    imageCount: images.length,
    ignoredEntries,
  }
}
