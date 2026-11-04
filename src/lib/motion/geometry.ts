import type { Shape } from "./types";

export function polygonPoints(sides: number, radius: number, star = false, inner = 0.45): [number, number][] {
  const n = star ? sides * 2 : sides;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const r = star && i % 2 === 1 ? radius * inner : radius;
    pts.push([+(Math.cos(a) * r).toFixed(3), +(Math.sin(a) * r).toFixed(3)]);
  }
  return pts;
}

export function shapeBox(s: Shape): { w: number; h: number } {
  switch (s.kind) {
    case "rect": case "ellipse": return { w: s.w, h: s.h };
    case "polygon": return { w: s.radius * 2, h: s.radius * 2 };
    case "text": return { w: s.text.length * s.size * 0.58, h: s.size * 1.2 };
  }
}

/** CSS for the inner element of an exported layer (outer element carries the transform). */
export function shapeCss(s: Shape, fill: string, stroke?: { color: string; width: number }): string {
  const st = stroke ? `box-shadow: inset 0 0 0 ${stroke.width}px ${stroke.color};` : "";
  switch (s.kind) {
    case "rect": return `width: ${s.w}px; height: ${s.h}px; border-radius: ${s.r ?? 0}px; background: ${fill}; ${st}`.trim();
    case "ellipse": return `width: ${s.w}px; height: ${s.h}px; border-radius: 50%; background: ${fill}; ${st}`.trim();
    case "polygon": {
      const pts = polygonPoints(s.sides, s.radius, s.star, s.inner).map(([x, y]) => `${(((x + s.radius) / (s.radius * 2)) * 100).toFixed(2)}% ${(((y + s.radius) / (s.radius * 2)) * 100).toFixed(2)}%`);
      return `width: ${s.radius * 2}px; height: ${s.radius * 2}px; background: ${fill}; clip-path: polygon(${pts.join(", ")});`;
    }
    case "text": return `font: ${s.weight ?? 600} ${s.size}px/1 system-ui, sans-serif; color: ${fill}; white-space: nowrap;`;
  }
}

export function hexToRgb01(hex: string): [number, number, number, number] {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = (i: number) => parseInt(h.slice(i, i + 2), 16) / 255;
  return [+n(0).toFixed(4), +n(2).toFixed(4), +n(4).toFixed(4), h.length === 8 ? +n(6).toFixed(4) : 1];
}
