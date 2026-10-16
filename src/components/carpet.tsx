"use client";

import type { ThreeEvent } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { applyCenterFog } from "./room-grid";

const CARPET_THICKNESS = 1.5;

export function Carpet({
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
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: highlighted ? "#f97316" : "#9d9da3",
        roughness: 1,
        metalness: 0,
      }),
    [highlighted]
  );

  useEffect(() => applyCenterFog(material, fogCenter), [material, fogCenter]);
  useEffect(() => () => material.dispose(), [material]);

  return (
    <group onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
      <RoundedBox
        args={[width, CARPET_THICKNESS, depth]}
        radius={0.5}
        smoothness={4}
        position={[0, CARPET_THICKNESS / 2, 0]}
        material={material}
      />
    </group>
  );
}
