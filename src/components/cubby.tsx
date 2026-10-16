"use client";

import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { applyCenterFog } from "./room-grid";

const CUBBY_SIZE = 40;
const CUBBY_COUNT = 3;
const PLATE_THICKNESS = 5;
const STACK_HEIGHT = CUBBY_SIZE * CUBBY_COUNT;

function plateRanges() {
  const ranges: Array<[number, number]> = [];
  for (let i = 0; i < CUBBY_COUNT; i++) {
    const bottom = CUBBY_SIZE * i;
    ranges.push([bottom, bottom + PLATE_THICKNESS]);
    ranges.push([
      bottom + CUBBY_SIZE - PLATE_THICKNESS,
      bottom + CUBBY_SIZE,
    ]);
  }
  return ranges;
}

export function CubbyStack({
  width,
  depth,
  highlighted = false,
  fogCenter,
  onPointerDown,
  onPointerUp,
}: {
  width: number;
  depth: number;
  highlighted?: boolean;
  fogCenter: { value: THREE.Vector3 };
  onPointerDown?: (event: ThreeEvent<PointerEvent>) => void;
  onPointerUp?: (event: ThreeEvent<PointerEvent>) => void;
}) {
  const { backMaterial, plateMaterial } = useMemo(() => {
    const backMaterial = new THREE.MeshStandardMaterial({
      color: highlighted ? "#f97316" : "#1c1c22",
      roughness: 0.45,
      metalness: 0.6,
    });
    const plateMaterial = new THREE.MeshStandardMaterial({
      color: highlighted ? "#fb923c" : "#52525b",
      roughness: 0.45,
      metalness: 0.6,
    });
    return { backMaterial, plateMaterial };
  }, [highlighted]);

  useEffect(() => applyCenterFog(backMaterial, fogCenter), [
    backMaterial,
    fogCenter,
  ]);
  useEffect(() => applyCenterFog(plateMaterial, fogCenter), [
    plateMaterial,
    fogCenter,
  ]);
  useEffect(
    () => () => {
      backMaterial.dispose();
      plateMaterial.dispose();
    },
    [backMaterial, plateMaterial]
  );

  const halfW = width / 2;
  const backX = -halfW + PLATE_THICKNESS / 2;
  const plateY = plateRanges().map(([from, to]) => (from + to) / 2);

  return (
    <group onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
      <mesh position={[backX, STACK_HEIGHT / 2, 0]} material={backMaterial}>
        <boxGeometry args={[PLATE_THICKNESS, STACK_HEIGHT, depth]} />
      </mesh>
      {plateY.map((y, index) => (
        <mesh key={`plate-${index}`} position={[0, y, 0]} material={plateMaterial}>
          <boxGeometry args={[width - PLATE_THICKNESS, PLATE_THICKNESS, depth]} />
        </mesh>
      ))}
    </group>
  );
}
