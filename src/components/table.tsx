"use client";

import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { applyCenterFog } from "./room-grid";

const TOP_THICKNESS = 5;
const LEG_HEIGHT = 60;
const LEG_SIZE = 6;
const LEG_INSET = 5;

export function Table({
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
  const { topMaterial, legMaterial } = useMemo(() => {
    const topMaterial = new THREE.MeshStandardMaterial({
      color: highlighted ? "#f97316" : "#f4f4f5",
      roughness: 0.6,
    });
    const legMaterial = new THREE.MeshStandardMaterial({
      color: highlighted ? "#fb923c" : "#e4e4e7",
      roughness: 0.6,
    });
    applyCenterFog(topMaterial, fogCenter);
    applyCenterFog(legMaterial, fogCenter);
    return { topMaterial, legMaterial };
  }, [fogCenter, highlighted]);

  useEffect(
    () => () => {
      topMaterial.dispose();
      legMaterial.dispose();
    },
    [topMaterial, legMaterial]
  );

  const topY = LEG_HEIGHT + TOP_THICKNESS / 2;
  const legY = LEG_HEIGHT / 2;

  const legOffsets: Array<[number, number]> = [
    [-(width / 2 - LEG_INSET), -(depth / 2 - LEG_INSET)],
    [width / 2 - LEG_INSET, -(depth / 2 - LEG_INSET)],
    [-(width / 2 - LEG_INSET), depth / 2 - LEG_INSET],
    [width / 2 - LEG_INSET, depth / 2 - LEG_INSET],
  ];

  return (
    <group onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
      <mesh position={[0, topY, 0]} material={topMaterial}>
        <boxGeometry args={[width, TOP_THICKNESS, depth]} />
      </mesh>
      {legOffsets.map(([x, z], index) => (
        <mesh
          key={`leg-${index}`}
          position={[x, legY, z]}
          material={legMaterial}
        >
          <boxGeometry args={[LEG_SIZE, LEG_HEIGHT, LEG_SIZE]} />
        </mesh>
      ))}
    </group>
  );
}
