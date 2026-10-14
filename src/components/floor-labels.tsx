import { Text } from "@react-three/drei";
import type { RoomDimensions } from "./room-grid";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function columnLabel(index: number) {
  const cycle = Math.floor(index / LETTERS.length);
  const letter = LETTERS[index % LETTERS.length];
  return cycle === 0 ? letter : `${letter}${cycle + 1}`;
}

function cellCenters(size: number, step: number) {
  const centers: number[] = [];
  let start = 0;
  while (start < size - 0.001) {
    const end = Math.min(start + step, size);
    centers.push(start + (end - start) / 2 - size / 2);
    start = end;
  }
  return centers;
}

export function FloorLabels({
  dimensions,
  step = 20,
}: {
  dimensions: RoomDimensions;
  step?: number;
}) {
  const columns = cellCenters(dimensions.width, step);
  const rows = cellCenters(dimensions.depth, step);

  return (
    <group>
      {columns.map((x, i) => (
        <Text
          key={`column-${i}`}
          position={[x, 0.5, dimensions.depth / 2 + 9]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={7}
          color="#a1a1aa"
          anchorX="center"
          anchorY="middle"
        >
          {columnLabel(i)}
        </Text>
      ))}
      {rows.map((z, i) => (
        <Text
          key={`row-${i}`}
          position={[dimensions.width / 2 + 9, 0.5, z]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={7}
          color="#a1a1aa"
          anchorX="center"
          anchorY="middle"
        >
          {String(i + 1)}
        </Text>
      ))}
    </group>
  );
}
