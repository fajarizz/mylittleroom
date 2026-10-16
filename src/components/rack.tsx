"use client";

import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { applyCenterFog } from "./room-grid";

const RACK_HEIGHT = 200;
const SHELF_THICKNESS = 2.5;
const POST_SIZE = 3;
const SHELF_TOPS = [2, 50, 100, 150, 199];
const RIVET_STEP = 25;

export function Rack({
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
  const { postMaterial, shelfMaterial } = useMemo(() => {
    const postMaterial = new THREE.MeshStandardMaterial({
      color: highlighted ? "#f97316" : "#1c1c22",
      roughness: 0.45,
      metalness: 0.6,
    });
    const shelfMaterial = new THREE.MeshStandardMaterial({
      color: highlighted ? "#fb923c" : "#52525b",
      roughness: 0.45,
      metalness: 0.6,
    });
    return { postMaterial, shelfMaterial };
  }, [highlighted]);

  useEffect(() => applyCenterFog(postMaterial, fogCenter), [
    postMaterial,
    fogCenter,
  ]);
  useEffect(() => applyCenterFog(shelfMaterial, fogCenter), [
    shelfMaterial,
    fogCenter,
  ]);
  useEffect(
    () => () => {
      postMaterial.dispose();
      shelfMaterial.dispose();
    },
    [postMaterial, shelfMaterial]
  );

  const halfW = width / 2;
  const halfD = depth / 2;
  const postX = halfW - POST_SIZE / 2;
  const postZ = halfD - POST_SIZE / 2;
  const posts: Array<[number, number]> = [
    [-postX, -postZ],
    [postX, -postZ],
    [-postX, postZ],
    [postX, postZ],
  ];

  const rivets: Array<[number, number, number]> = [];
  for (const [x, z] of posts) {
    for (let y = RIVET_STEP; y < RACK_HEIGHT - 5; y += RIVET_STEP) {
      rivets.push([x, y, z]);
    }
  }

  return (
    <group onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
      {posts.map(([x, z], index) => (
        <mesh key={`post-${index}`} position={[x, RACK_HEIGHT / 2, z]} material={postMaterial}>
          <boxGeometry args={[POST_SIZE, RACK_HEIGHT, POST_SIZE]} />
        </mesh>
      ))}
      {SHELF_TOPS.map((top, index) => (
        <mesh
          key={`shelf-${index}`}
          position={[0, top - SHELF_THICKNESS / 2, 0]}
          material={shelfMaterial}
        >
          <boxGeometry args={[width, SHELF_THICKNESS, depth]} />
        </mesh>
      ))}
      {rivets.map(([x, y, z], index) => (
        <mesh key={`rivet-${index}`} position={[x, y, z]} material={postMaterial}>
          <sphereGeometry args={[0.6, 8, 8]} />
        </mesh>
      ))}
    </group>
  );
}
