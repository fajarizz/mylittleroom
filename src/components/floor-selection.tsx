"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import {
  applyCenterFog,
  buildFaceGeometry,
  type RoomDimensions,
} from "./room-grid";
import { cellAddresses, type CellAddresses } from "./floor-labels";

export type SelectedCell = {
  name: string;
  from: [number, number];
  to: [number, number];
};

export type CellSelection = {
  anchor: { i: number; j: number };
  head: { i: number; j: number };
};

export function cellRect(
  selection: CellSelection | null,
  addresses: CellAddresses
): SelectedCell | null {
  if (!selection) return null;
  const minI = Math.min(selection.anchor.i, selection.head.i);
  const maxI = Math.max(selection.anchor.i, selection.head.i);
  const minJ = Math.min(selection.anchor.j, selection.head.j);
  const maxJ = Math.max(selection.anchor.j, selection.head.j);
  if (
    maxI >= addresses.boundsX.length - 1 ||
    maxJ >= addresses.boundsZ.length - 1
  ) {
    return null;
  }
  const cornerName = (i: number, j: number) =>
    `${addresses.columnLabels[i]}${addresses.rowLabels[j]}`;
  const isRange = minI !== maxI || minJ !== maxJ;
  return {
    name: isRange
      ? `${cornerName(minI, minJ)} → ${cornerName(maxI, maxJ)}`
      : cornerName(minI, minJ),
    from: [
      addresses.boundsX[minI],
      addresses.boundsZ[minJ],
    ] as [number, number],
    to: [
      addresses.boundsX[maxI + 1],
      addresses.boundsZ[maxJ + 1],
    ] as [number, number],
  };
}

export function useMarchingDashes(geometry: THREE.BufferGeometry, speed = 8) {
  const baseDistances = useMemo(() => {
    const attribute = geometry.getAttribute("lineDistance");
    return Float32Array.from(attribute.array as Float32Array);
  }, [geometry]);

  useFrame(({ clock }) => {
    const attribute = geometry.getAttribute("lineDistance");
    const array = attribute.array as Float32Array;
    const offset = clock.getElapsedTime() * speed;
    for (let i = 0; i < array.length; i++) {
      array[i] = baseDistances[i] - offset;
    }
    attribute.needsUpdate = true;
  });
}

export function MarchingRectangle({
  x0,
  x1,
  z0,
  z1,
  y = 0.4,
  color = "#3f3f46",
  fogCenter,
}: {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  y?: number;
  color?: string;
  fogCenter: { value: THREE.Vector3 };
}) {
  const geometry = useMemo(
    () =>
      buildFaceGeometry((push) => {
        push([x0, 0, z0], [x0, 0, z1]);
        push([x1, 0, z0], [x1, 0, z1]);
        push([x0, 0, z0], [x1, 0, z0]);
        push([x0, 0, z1], [x1, 0, z1]);
      }),
    [x0, x1, z0, z1]
  );

  useMarchingDashes(geometry);

  const material = useMemo(
    () =>
      new THREE.LineDashedMaterial({
        color,
        dashSize: 4,
        gapSize: 3,
        transparent: true,
        opacity: 0.9,
      }),
    [color]
  );

  useEffect(() => applyCenterFog(material, fogCenter), [material, fogCenter]);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material]
  );

  return (
    <lineSegments geometry={geometry} position={[0, y, 0]}>
      <primitive object={material} attach="material" />
    </lineSegments>
  );
}

function planeSpan(bounds: number[]) {
  return bounds[bounds.length - 1] - bounds[0];
}

export function FloorSelection({
  dimensions,
  step,
  fogCenter,
  selection,
  onSelect,
  onFloorPointerMove,
  onFloorPointerUp,
}: {
  dimensions: RoomDimensions;
  step: number;
  fogCenter: { value: THREE.Vector3 };
  selection: CellSelection | null;
  onSelect: (selection: CellSelection | null) => void;
  onFloorPointerMove?: (event: ThreeEvent<PointerEvent>) => void;
  onFloorPointerUp?: (event: ThreeEvent<PointerEvent>) => void;
}) {
  const addresses = useMemo(
    () => cellAddresses(dimensions, step),
    [dimensions, step]
  );
  const dragStartRef = useRef<{ x: number; y: number; shift: boolean } | null>(
    null
  );

  const findIndex = (bounds: number[], value: number) => {
    for (let k = 0; k < bounds.length - 1; k++) {
      if (value >= bounds[k] - 0.001 && value <= bounds[k + 1] + 0.001) {
        return k;
      }
    }
    return -1;
  };

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    dragStartRef.current = {
      x: event.nativeEvent.clientX,
      y: event.nativeEvent.clientY,
      shift: event.nativeEvent.shiftKey,
    };
  };

  const handlePointerUp = (event: ThreeEvent<PointerEvent>) => {
    const start = dragStartRef.current;
    dragStartRef.current = null;
    if (!start) return;
    const dx = event.nativeEvent.clientX - start.x;
    const dy = event.nativeEvent.clientY - start.y;
    if (Math.hypot(dx, dy) > 4) return;
    const shift = event.nativeEvent.shiftKey || start.shift;

    const i = findIndex(addresses.boundsX, event.point.x);
    const j = findIndex(addresses.boundsZ, event.point.z);
    if (i < 0 || j < 0) return;
    const cell = { i, j };

    if (shift && selection) {
      onSelect({ anchor: selection.anchor, head: cell });
      return;
    }
    const isAnchor =
      selection &&
      selection.anchor.i === cell.i &&
      selection.anchor.j === cell.j;
    if (isAnchor) {
      onSelect(null);
    } else {
      onSelect({ anchor: cell, head: cell });
    }
  };

  const selectionMeta = useMemo(
    () => cellRect(selection, addresses),
    [selection, addresses]
  );

  return (
    <group>
      <mesh
        position={[0, 0.15, (addresses.boundsZ[0] + addresses.boundsZ[addresses.boundsZ.length - 1]) / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={handlePointerDown}
        onPointerUp={(event) => {
          handlePointerUp(event);
          onFloorPointerUp?.(event);
        }}
        onPointerMove={(event) => onFloorPointerMove?.(event)}
      >
        <planeGeometry
          args={[
            planeSpan(addresses.boundsX),
            planeSpan(addresses.boundsZ),
          ]}
        />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {selectionMeta && (
        <MarchingRectangle
          x0={selectionMeta.from[0]}
          x1={selectionMeta.to[0]}
          z0={selectionMeta.from[1]}
          z1={selectionMeta.to[1]}
          fogCenter={fogCenter}
        />
      )}
    </group>
  );
}
