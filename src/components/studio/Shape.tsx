import type { Layer } from "@/lib/motion";
import { polygonPoints } from "@/lib/motion";

export function ShapeEl({ layer, ghost }: { layer: Layer; ghost?: string }) {
  const s = layer.shape;
  const fill = ghost ? "none" : layer.fill;
  const stroke = ghost ?? layer.stroke?.color;
  const sw = ghost ? 1.5 : layer.stroke?.width;
  switch (s.kind) {
    case "rect": return <rect x={-s.w / 2} y={-s.h / 2} width={s.w} height={s.h} rx={s.r ?? 0} fill={fill} stroke={stroke} strokeWidth={sw} vectorEffect="non-scaling-stroke" />;
    case "ellipse": return <ellipse rx={s.w / 2} ry={s.h / 2} fill={fill} stroke={stroke} strokeWidth={sw} vectorEffect="non-scaling-stroke" />;
    case "polygon": return <polygon points={polygonPoints(s.sides, s.radius, s.star, s.inner).map((p) => p.join(",")).join(" ")} fill={fill} stroke={stroke} strokeWidth={sw} vectorEffect="non-scaling-stroke" />;
    case "text": return <text textAnchor="middle" dominantBaseline="central" fontSize={s.size} fontWeight={s.weight ?? 600} fill={ghost ? "none" : layer.fill} stroke={ghost} strokeWidth={ghost ? 1 : 0} style={{ fontFamily: "var(--font-display)" }}>{s.text}</text>;
  }
}
