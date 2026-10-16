import { memo } from "react";
import { Text } from "@react-three/drei";
import { bandAxes, type RoomDimensions } from "./room-grid";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LETTERS_BACK = [...LETTERS].reverse().join("");

type BoundaryCell = { center: number; index: number };

function boundaryCells(bounds: number[]): BoundaryCell[] {
  const cells: BoundaryCell[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    cells.push({ center: (bounds[i] + bounds[i + 1]) / 2, index: i });
  }
  return cells;
}

export function axisLabels(
  bounds: number[],
  halfSize: number,
  kind: "letters" | "numbers"
): string[] {
  const cells = boundaryCells(bounds);
  const insideCount = cells.filter(
    ({ center }) => center > -halfSize && center < halfSize
  ).length;
  const negExtCount = cells.filter(
    ({ center }) => center < -halfSize - 0.001
  ).length;
  let insideIndex = 0;
  let negIndex = 0;
  let posIndex = 0;

  const letterLabel = (i: number) => {
    const cycle = Math.floor(i / LETTERS.length);
    return LETTERS[i % LETTERS.length] + (cycle === 0 ? "" : String(cycle + 1));
  };

  return cells.map(({ center }) => {
    if (center < -halfSize - 0.001) {
      const fromWall = negExtCount - 1 - negIndex;
      negIndex += 1;
      return kind === "letters" ? LETTERS_BACK[fromWall] : String(-fromWall);
    }
    if (center > halfSize + 0.001) {
      const i = posIndex;
      posIndex += 1;
      return kind === "letters" ? letterLabel(insideCount + i) : String(insideCount + 1 + i);
    }
    const i = insideIndex;
    insideIndex += 1;
    return kind === "letters" ? letterLabel(i) : String(i + 1);
  });
}

export type CellAddresses = {
  boundsX: number[];
  boundsZ: number[];
  columnLabels: string[];
  rowLabels: string[];
  columnIndex: (label: string) => number;
  rowIndex: (label: string) => number;
};

export function cellAddresses(
  dimensions: RoomDimensions,
  step: number
): CellAddresses {
  const { boundsX, boundsZ } = bandAxes(dimensions, step);
  const cells = boundaryCells(boundsX);
  const columnCount = cells.length;
  const insideColumnCount = cells.filter(
    ({ center }) => center > -dimensions.width / 2 && center < dimensions.width / 2
  ).length;
  const westExtCount = cells.filter(
    ({ center }) => center < -dimensions.width / 2 - 0.001
  ).length;

  const rowCells = boundaryCells(boundsZ);
  const insideRowCount = rowCells.filter(
    ({ center }) => center > -dimensions.depth / 2 && center < dimensions.depth / 2
  ).length;
  const northExtCount = rowCells.filter(
    ({ center }) => center < -dimensions.depth / 2 - 0.001
  ).length;

  return {
    boundsX,
    boundsZ,
    columnLabels: axisLabels(boundsX, dimensions.width / 2, "letters"),
    rowLabels: axisLabels(boundsZ, dimensions.depth / 2, "numbers"),
    columnIndex: (label) => {
      const letterIndex = LETTERS.indexOf(label[0]);
      const cycle = Number(label.slice(1));
      const insideIndex =
        letterIndex + (cycle >= 2 ? (cycle - 1) * LETTERS.length : 0);
      if (insideIndex >= 0 && insideIndex < insideColumnCount) {
        return westExtCount + insideIndex;
      }
      const westIndex = LETTERS_BACK.indexOf(label);
      if (westIndex >= 0 && westIndex < westExtCount) return westIndex;
      return -1;
    },
    rowIndex: (label) => {
      const number = Number(label);
      if (!Number.isFinite(number)) return -1;
      if (number <= 0) {
        const northIndex = number + northExtCount - 1;
        return northIndex >= 0 && northIndex < northExtCount ? northIndex : -1;
      }
      const insideIndex = number - 1;
      if (insideIndex < insideRowCount) return northExtCount + insideIndex;
      const southIndex = insideRowCount + 1 + northExtCount + (number - insideRowCount - 1);
      return southIndex < rowCells.length ? southIndex : -1;
    },
  };
}

export type CellFootprint = {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
};

export function cellFootprint(
  dimensions: RoomDimensions,
  step: number,
  from: readonly [string, string],
  to: readonly [string, string]
): CellFootprint | null {
  const addresses = cellAddresses(dimensions, step);
  const columnStart = addresses.columnIndex(from[0]);
  const columnEnd = addresses.columnIndex(to[0]);
  const rowStart = addresses.rowIndex(from[1]);
  const rowEnd = addresses.rowIndex(to[1]);
  if (
    columnStart < 0 ||
    columnEnd < 0 ||
    rowStart < 0 ||
    rowEnd < 0 ||
    columnEnd >= addresses.boundsX.length - 1 ||
    rowEnd >= addresses.boundsZ.length - 1
  ) {
    return null;
  }
  return {
    x0: addresses.boundsX[columnStart],
    x1: addresses.boundsX[columnEnd + 1],
    z0: addresses.boundsZ[rowStart],
    z1: addresses.boundsZ[rowEnd + 1],
  };
}

export function cellAt(
  addresses: CellAddresses,
  x: number,
  z: number
): { name: string; from: [number, number]; to: [number, number] } | null {
  const findIndex = (bounds: number[], labels: string[], value: number) => {
    let index = -1;
    for (let k = 0; k < bounds.length - 1; k++) {
      if (value >= bounds[k] - 0.001 && value <= bounds[k + 1] + 0.001) {
        index = k;
      }
    }
    return index;
  };
  const i = findIndex(addresses.boundsX, addresses.columnLabels, x);
  const j = findIndex(addresses.boundsZ, addresses.rowLabels, z);
  if (i < 0 || j < 0) return null;
  return {
    name: `${addresses.columnLabels[i]}${addresses.rowLabels[j]}`,
    from: [addresses.boundsX[i], addresses.boundsZ[j]],
    to: [addresses.boundsX[i + 1], addresses.boundsZ[j + 1]],
  };
}

export const FloorLabels = memo(function FloorLabels({
  dimensions,
  step = 10,
}: {
  dimensions: RoomDimensions;
  step?: number;
}) {
  const halfW = dimensions.width / 2;
  const halfD = dimensions.depth / 2;
  const { boundsX, boundsZ } = bandAxes(dimensions, step);

  const columns = boundaryCells(boundsX);
  const rows = boundaryCells(boundsZ);
  const columnLabels = axisLabels(boundsX, halfW, "letters");
  const rowLabels = axisLabels(boundsZ, halfD, "numbers");

  const letterRows = [halfD + 9, -halfD - 9];
  const numberColumns = [halfW + 9, -halfW - 9];

  return (
    <group>
      {letterRows.map((z) =>
        columns.map((cell, i) => (
          <Text
            key={`letter-${z}-${cell.index}`}
            position={[cell.center, 0.5, z]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={5.5}
            color="#a1a1aa"
            anchorX="center"
            anchorY="middle"
          >
            {columnLabels[cell.index]}
          </Text>
        ))
      )}
      {numberColumns.map((x) =>
        rows.map((cell) => (
          <Text
            key={`number-${x}-${cell.index}`}
            position={[x, 0.5, cell.center]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={5.5}
            color="#a1a1aa"
            anchorX="center"
            anchorY="middle"
          >
            {rowLabels[cell.index]}
          </Text>
        ))
      )}
    </group>
  );
});
