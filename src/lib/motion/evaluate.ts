import { easeFn } from "./easing";
import type { Keyframe, Layer, Prop, Timeline } from "./types";
import { PROPS } from "./types";

export function valueAt(track: Keyframe[] | undefined, t: number, fallback: number): number {
  if (!track || track.length === 0) return fallback;
  if (t <= track[0].t) return track[0].v;
  const last = track[track.length - 1];
  if (t >= last.t) return last.v;
  for (let i = 0; i < track.length - 1; i++) {
    const a = track[i], b = track[i + 1];
    if (t >= a.t && t < b.t) {
      const span = b.t - a.t;
      if (span <= 0) return b.v;
      const p = easeFn(a.ease)((t - a.t) / span);
      return a.v + (b.v - a.v) * p;
    }
  }
  return last.v;
}

export type LayerState = Record<Prop, number>;

export function layerStateAt(layer: Layer, t: number): LayerState {
  const s = {} as LayerState;
  for (const p of PROPS) s[p] = valueAt(layer.tracks[p], t, layer.base[p]);
  return s;
}

export function timelineStateAt(tl: Timeline, t: number): LayerState[] {
  return tl.layers.map((l) => layerStateAt(l, t));
}

/** Sampled numeric derivative in units/second — used by the validator and the graph editor. */
export function velocityAt(track: Keyframe[] | undefined, t: number, fallback: number): number {
  const h = 1;
  return ((valueAt(track, t + h, fallback) - valueAt(track, t - h, fallback)) / (2 * h)) * 1000;
}
