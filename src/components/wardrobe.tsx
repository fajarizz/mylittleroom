"use client";

import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { applyCenterFog } from "./room-grid";

const BODY_HEIGHT = 200;
const DOOR_GAP = 1;
const KNOB_RADIUS = 0.7;
const KNOB_LENGTH = 5;
const KNOB_HEIGHT = 100;
const KNOB_SEAM_OFFSET = 3;

export function Wardrobe({
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
  const { bodyMaterial, knobMaterial } = useMemo(() => {
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: highlighted ? "#f97316" : "#ececee",
      roughness: 0.65,
    });
    const knobMaterial = new THREE.MeshStandardMaterial({
      color: highlighted ? "#fdba74" : "#a1a1aa",
      roughness: 0.4,
    });
    applyCenterFog(bodyMaterial, fogCenter);
    applyCenterFog(knobMaterial, fogCenter);
    return { bodyMaterial, knobMaterial };
  }, [fogCenter, highlighted]);

  useEffect(
    () => () => {
      bodyMaterial.dispose();
      knobMaterial.dispose();
    },
    [bodyMaterial, knobMaterial]
  );

  const doorWidth = (width - DOOR_GAP) / 2;
  const bodyY = BODY_HEIGHT / 2;

  const knobPositions: Array<number> = [
    -DOOR_GAP / 2 - KNOB_SEAM_OFFSET,
    DOOR_GAP / 2 + KNOB_SEAM_OFFSET,
  ];

  return (
    <group onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
      <mesh
        position={[-(doorWidth / 2 + DOOR_GAP / 2), bodyY, 0]}
        material={bodyMaterial}
      >
        <boxGeometry args={[doorWidth, BODY_HEIGHT, depth]} />
      </mesh>
      <mesh
        position={[doorWidth / 2 + DOOR_GAP / 2, bodyY, 0]}
        material={bodyMaterial}
      >
        <boxGeometry args={[doorWidth, BODY_HEIGHT, depth]} />
      </mesh>
      {knobPositions.map((x, index) => (
        <mesh
          key={`knob-${index}`}
          position={[x, KNOB_HEIGHT, depth / 2 + KNOB_LENGTH / 2]}
          rotation={[Math.PI / 2, 0, 0]}
          material={knobMaterial}
        >
          <cylinderGeometry args={[KNOB_RADIUS, KNOB_RADIUS, KNOB_LENGTH, 16]} />
        </mesh>
      ))}
    </group>
  );
}
