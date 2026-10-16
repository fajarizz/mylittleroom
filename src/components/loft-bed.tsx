"use client";

import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { applyCenterFog } from "./room-grid";

const FRAME_HEIGHT = 200;
const DECK_CLEARANCE = 160;
const DECK_THICKNESS = 5;
const POST_SIZE = 3;
const GUARD_HEIGHT = 176;
const POST_INSET = 4;
const LADDER_RAIL_SPAN = 40;
const LADDER_PROTRUDE = 2;
const RUNG_STEP = 20;

export function LoftBed({
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
  const { frameMaterial, ladderMaterial } = useMemo(() => {
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: highlighted ? "#f97316" : "#3f3f46",
      roughness: 0.4,
      metalness: 0.6,
    });
    const ladderMaterial = new THREE.MeshStandardMaterial({
      color: highlighted ? "#fb923c" : "#52525b",
      roughness: 0.4,
      metalness: 0.6,
    });
    applyCenterFog(frameMaterial, fogCenter);
    applyCenterFog(ladderMaterial, fogCenter);
    return { frameMaterial, ladderMaterial };
  }, [fogCenter, highlighted]);

  useEffect(
    () => () => {
      frameMaterial.dispose();
      ladderMaterial.dispose();
    },
    [frameMaterial, ladderMaterial]
  );

  const halfW = width / 2;
  const halfD = depth / 2;
  const px = halfW - POST_INSET;
  const pz = halfD - POST_INSET;
  const deckY = DECK_CLEARANCE + DECK_THICKNESS / 2;
  const ladderZ = halfD + LADDER_PROTRUDE;
  const leftPillarX = -halfW + POST_INSET;
  const railNearX = leftPillarX;
  const railFarX = leftPillarX + LADDER_RAIL_SPAN;
  const railMidX = (railNearX + railFarX) / 2;
  const rungStart = 15;
  const rungCount = Math.floor((DECK_CLEARANCE - 10 - rungStart) / RUNG_STEP) + 1;
  const rungs = Array.from({ length: rungCount }, (_, i) => rungStart + i * RUNG_STEP);
  const rungLength = LADDER_RAIL_SPAN - 1.5;

  const postOffsets: Array<[number, number]> = [
    [-px, -pz],
    [px, -pz],
    [-px, pz],
    [px, pz],
  ];

  return (
    <group onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
      {postOffsets.map(([x, z], index) => (
        <mesh
          key={`post-${index}`}
          position={[x, FRAME_HEIGHT / 2, z]}
          material={frameMaterial}
        >
          <boxGeometry args={[POST_SIZE, FRAME_HEIGHT, POST_SIZE]} />
        </mesh>
      ))}
      <mesh position={[0, deckY, 0]} material={frameMaterial}>
        <boxGeometry args={[width, DECK_THICKNESS, depth]} />
      </mesh>
      {[FRAME_HEIGHT - 1, GUARD_HEIGHT].map((railY) => (
        <group key={`rail-${railY}`}>
          <mesh position={[-px, railY, 0]} material={frameMaterial}>
            <boxGeometry args={[POST_SIZE, POST_SIZE, depth - POST_INSET * 2]} />
          </mesh>
          <mesh position={[px, railY, 0]} material={frameMaterial}>
            <boxGeometry args={[POST_SIZE, POST_SIZE, depth - POST_INSET * 2]} />
          </mesh>
          <mesh position={[0, railY, -pz]} material={frameMaterial}>
            <boxGeometry args={[width - POST_INSET * 2, POST_SIZE, POST_SIZE]} />
          </mesh>
          <mesh position={[0, railY, pz]} material={frameMaterial}>
            <boxGeometry args={[width - POST_INSET * 2, POST_SIZE, POST_SIZE]} />
          </mesh>
        </group>
      ))}
      <mesh
        position={[railNearX, DECK_CLEARANCE / 2, ladderZ]}
        material={ladderMaterial}
      >
        <boxGeometry args={[2.4, DECK_CLEARANCE, 2.4]} />
      </mesh>
      <mesh
        position={[railFarX, DECK_CLEARANCE / 2, ladderZ]}
        material={ladderMaterial}
      >
        <boxGeometry args={[2.4, DECK_CLEARANCE, 2.4]} />
      </mesh>
      {rungs.map((y) => (
        <mesh
          key={`rung-${y}`}
          position={[railMidX, y, ladderZ]}
          material={ladderMaterial}
        >
          <boxGeometry args={[rungLength, 2.5, 2.5]} />
        </mesh>
      ))}
    </group>
  );
}
