import * as React from "react"

/**
 * The Material "audiotrack" glyph, drawn inline rather than pulled from
 * @mui/icons-material: that package brings @mui/material and Emotion with it,
 * which is a large dependency for a single icon. The path is Google's Material
 * icon (Apache 2.0), the same artwork AudiotrackOutlinedIcon renders.
 *
 * Colour follows the surrounding text, so it turns white inside a filled button
 * exactly like the lucide icons beside it.
 */
export const AudiotrackOutlinedIcon = ({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
    className={className}
    {...props}
  >
    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6zm-2 16c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" />
  </svg>
)

export default AudiotrackOutlinedIcon
