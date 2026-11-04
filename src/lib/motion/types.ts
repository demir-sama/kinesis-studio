/**
 * Kinesis Timeline (KTL) — the single source of truth for every animation.
 * Times are milliseconds. Positions are canvas pixels (layer centre).
 * A keyframe's `ease` describes the segment that leaves it (After Effects "out" convention).
 */
export const PROPS = ["x", "y", "scaleX", "scaleY", "rotate", "opacity"] as const;
export type Prop = (typeof PROPS)[number];

export type EaseSpec =
  | { type: "linear" }
  | { type: "bezier"; x1: number; y1: number; x2: number; y2: number; name?: string }
  | { type: "spring"; stiffness: number; damping: number; mass: number }
  | { type: "steps"; count: number }
  | { type: "hold" };

export interface Keyframe {
  t: number;
  v: number;
  ease?: EaseSpec;
}

export type Shape =
  | { kind: "rect"; w: number; h: number; r?: number }
  | { kind: "ellipse"; w: number; h: number }
  | { kind: "polygon"; sides: number; radius: number; star?: boolean; inner?: number }
  | { kind: "text"; text: string; size: number; weight?: number };

export interface Layer {
  id: string;
  name: string;
  shape: Shape;
  fill: string;
  stroke?: { color: string; width: number };
  /** Static values used when a property has no track. */
  base: Record<Prop, number>;
  tracks: Partial<Record<Prop, Keyframe[]>>;
}

export interface Timeline {
  version: 1;
  name: string;
  description?: string;
  duration: number;
  fps: number;
  size: { w: number; h: number };
  background: string;
  loop?: boolean;
  layers: Layer[];
}

export const PROP_META: Record<Prop, { label: string; unit: string; min: number; max: number; def: number }> = {
  x: { label: "Position X", unit: "px", min: -4000, max: 8000, def: 0 },
  y: { label: "Position Y", unit: "px", min: -4000, max: 8000, def: 0 },
  scaleX: { label: "Scale X", unit: "×", min: -20, max: 20, def: 1 },
  scaleY: { label: "Scale Y", unit: "×", min: -20, max: 20, def: 1 },
  rotate: { label: "Rotation", unit: "°", min: -36000, max: 36000, def: 0 },
  opacity: { label: "Opacity", unit: "", min: 0, max: 1, def: 1 },
};
