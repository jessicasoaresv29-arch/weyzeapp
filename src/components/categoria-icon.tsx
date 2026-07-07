import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";

const map: Record<string, LucideIcon> = {
  zap: Icons.Zap,
  droplet: Icons.Droplet,
  "paint-roller": Icons.PaintRoller,
  hammer: Icons.Hammer,
  sparkles: Icons.Sparkles,
  brush: Icons.Brush,
  axe: Icons.Axe,
  trees: Icons.Trees,
  snowflake: Icons.Snowflake,
  key: Icons.Key,
  laptop: Icons.Laptop,
  palette: Icons.Palette,
  camera: Icons.Camera,
  scale: Icons.Scale,
  calculator: Icons.Calculator,
  "graduation-cap": Icons.GraduationCap,
  wrench: Icons.Wrench,
  truck: Icons.Truck,
  package: Icons.Package,
  "more-horizontal": Icons.MoreHorizontal,
};

export function CategoriaIcon({ name, className }: { name: string; className?: string }) {
  const Icon = map[name] ?? Icons.Wrench;
  return <Icon className={className} strokeWidth={2} />;
}