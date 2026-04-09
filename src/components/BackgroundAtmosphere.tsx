/**
 * Two fixed non-interactive layers rendered behind all page content:
 *  1. `gradient-mesh` — multi-blob colour field that gives glassmorphism
 *     something rich to blur through. Colours shift between light and dark
 *     themes via CSS variables.
 *  2. `grain-overlay` — SVG feTurbulence noise at low opacity for texture.
 *  3. `spotlight` — a soft radial glow that follows --mouse-x / --mouse-y
 *     (updated by useMouseSpotlight in App).
 */
export function BackgroundAtmosphere() {
  return (
    <>
      {/* Colour field — blobs that the glass cards blur through */}
      <div aria-hidden className="gradient-mesh pointer-events-none fixed inset-0 z-0" />

      {/* Paper grain */}
      <div aria-hidden className="grain-overlay pointer-events-none fixed inset-0 z-0 select-none">
        <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
          <filter id="grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves="3" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain)" />
        </svg>
      </div>

      {/* Cursor spotlight */}
      <div aria-hidden className="spotlight pointer-events-none fixed inset-0 z-0" />
    </>
  )
}
