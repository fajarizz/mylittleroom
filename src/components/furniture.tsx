import * as THREE from "three";
import type { CellFootprint } from "./floor-labels";

export type PieceKind =
  | "table"
  | "wardrobe"
  | "loftBed"
  | "pegboard"
  | "carpet"
  | "rack"
  | "cubby";

export const PEGBOARD_WIDTHS = [60, 92, 150] as const;

export function resolvePegboardWidth(variant: unknown) {
  return PEGBOARD_WIDTHS.includes(variant as (typeof PEGBOARD_WIDTHS)[number])
    ? (variant as number)
    : 60;
}

export const INITIAL_PIECES: FurniturePiece[] = [
  { id: "table", x0: 0, z0: 75, rotations: 0 },
  { id: "wardrobe", x0: 20, z0: -135, rotations: 0 },
  { id: "loftBed", x0: -120, z0: -45, rotations: 1 },
  { id: "pegboard", x0: -120, z0: -135, rotations: 0 },
  { id: "carpet", x0: 0, z0: 35, rotations: 0 },
  { id: "rack", x0: 0, z0: 95, rotations: 0 },
  { id: "cubby", x0: -120, z0: 95, rotations: 0 },
];

export const PIECE_SPECS: Record<
  PieceKind,
  { width: number; depth: number; height: number; label: string }
> = {
  table: { width: 120, depth: 60, height: 65, label: "Table" },
  wardrobe: { width: 100, depth: 60, height: 200, label: "Wardrobe" },
  loftBed: { width: 90, depth: 200, height: 200, label: "Loft Bed" },
  pegboard: { width: 60, depth: 37, height: 180, label: "Pegboard" },
  carpet: { width: 120, depth: 100, height: 2, label: "Carpet" },
  rack: { width: 120, depth: 40, height: 200, label: "Rack" },
  cubby: { width: 40, depth: 40, height: 120, label: "Cubby Stack" },
};

export type FurniturePiece = {
  id: PieceKind;
  x0: number;
  z0: number;
  rotations: number;
  variant?: number;
};

export function parsePieceList(input: unknown): FurniturePiece[] {
  if (!Array.isArray(input)) return [];
  const pieces: FurniturePiece[] = [];
  const seen = new Set<string>();
  for (const entry of input) {
    const id = (entry as FurniturePiece)?.id;
    if (typeof id !== "string" || !(id in PIECE_SPECS) || seen.has(id)) continue;
    const x0 = Number((entry as FurniturePiece).x0);
    const z0 = Number((entry as FurniturePiece).z0);
    const rotations = Number((entry as FurniturePiece).rotations);
    if (
      !Number.isFinite(x0) ||
      !Number.isFinite(z0) ||
      !Number.isInteger(rotations) ||
      rotations < 0 ||
      rotations > 3
    ) {
      continue;
    }
    seen.add(id);
    const piece: FurniturePiece = { id: id as PieceKind, x0, z0, rotations };
    if (piece.id === "pegboard") {
      const variant = Number((entry as FurniturePiece).variant);
      if (Number.isFinite(variant)) {
        piece.variant = variant;
      }
    }
    pieces.push(piece);
  }
  return pieces;
}

export function pieceBaseSize(
  piece: FurniturePiece,
  spec = PIECE_SPECS[piece.id]
) {
  const baseWidth =
    piece.id === "pegboard" ? resolvePegboardWidth(piece.variant) : spec.width;
  return { width: baseWidth, depth: spec.depth };
}

export function pieceFootprint(
  piece: FurniturePiece,
  spec = PIECE_SPECS[piece.id]
): CellFootprint & { width: number; depth: number } {
  const base = pieceBaseSize(piece, spec);
  const swapped = piece.rotations % 2 === 1;
  const width = swapped ? base.depth : base.width;
  const depth = swapped ? base.width : base.depth;
  return {
    x0: piece.x0,
    x1: piece.x0 + width,
    z0: piece.z0,
    z1: piece.z0 + depth,
    width,
    depth,
  };
}

export function snapToGrid(value: number, origin = 0, step = 10) {
  return Math.round((value - origin) / step) * step + origin;
}
