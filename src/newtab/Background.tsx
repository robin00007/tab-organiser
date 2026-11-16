import type { TimeOfDay } from '../lib/types.ts'

/**
 * A generated backdrop: a sky gradient, three slowly drifting blurred blobs, a
 * few stars at night and a film of grain. Everything is CSS (see `newtab.css`),
 * so it needs no image files and no network.
 */
export function Background({ scene }: { scene: TimeOfDay }) {
  return (
    <div className="scene" data-scene={scene} aria-hidden="true">
      <div className="scene-blob scene-blob-a" />
      <div className="scene-blob scene-blob-b" />
      <div className="scene-blob scene-blob-c" />
      <div className="scene-stars" />
      <div className="scene-grain" />
    </div>
  )
}
