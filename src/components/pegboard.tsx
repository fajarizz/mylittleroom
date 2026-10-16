"use client";

import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { applyCenterFog } from "./room-grid";

const FRAME_HEIGHT = 180;
const PANEL_THICKNESS = 2;
const POST_SIZE = 3;
const SHELF_THICKNESS = 3;
const SHELF_DEPTH = 16;
const FEET_LENGTH = 18;
const UPPER_PANEL_HEIGHT = 66;
const LOWER_PANEL_HEIGHT = 60;
const UPPER_PANEL_BASE = 95;
const LOWER_PANEL_BASE = 30;
const MID_SHELF_Y = 91.5;

function createPegboardTexture(panelColor: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2d canvas context unavailable");
  context.fillStyle = panelColor;
  context.fillRect(0, 0, 128, 128);
  context.fillStyle = "#1b1b20";
  for (let x = 16; x < 128; x += 32) {
    for (let y = 16; y < 128; y += 32) {
      context.beginPath();
      context.arc(x, y, 3, 0, Math.PI * 2);
      context.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function Pegboard({
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
  const texture = useMemo(() => createPegboardTexture("#6b6b74"), []);

  const { frameMaterial, upperPanelMaterial, lowerPanelMaterial } = useMemo(
    () => {
      const frameMaterial = new THREE.MeshStandardMaterial({
        color: highlighted ? "#f97316" : "#1c1c22",
        roughness: 0.5,
        metalness: 0.55,
      });
      const panelGroups: Array<[THREE.Texture | null, number, number, string]> = [
        [highlighted ? null : texture, width - POST_SIZE * 2, UPPER_PANEL_HEIGHT, "#f97316"],
        [highlighted ? null : texture, width - POST_SIZE * 2, LOWER_PANEL_HEIGHT, "#f97316"],
      ];
      const [upperPanelMaterial, lowerPanelMaterial] = panelGroups.map(
        ([map, repeatX, repeatY, color]) => {
          const panelMaterial = new THREE.MeshStandardMaterial({
            roughness: 0.75,
            metalness: 0.15,
          });
          panelMaterial.color.set(color);
          if (map) {
            const mapped = map.clone();
            mapped.needsUpdate = true;
            mapped.repeat.set(repeatX / 20, repeatY / 20);
            panelMaterial.map = mapped;
            panelMaterial.color.set("#ffffff");
          } else {
            panelMaterial.color.set(color);
          }
          return panelMaterial;
        }
      );
      applyCenterFog(frameMaterial, fogCenter);
      upperPanelMaterial &&
        applyCenterFog(upperPanelMaterial, fogCenter);
      lowerPanelMaterial && applyCenterFog(lowerPanelMaterial, fogCenter);
      return { frameMaterial, upperPanelMaterial, lowerPanelMaterial };
    },
    [texture, highlighted, fogCenter]
  );

  useEffect(
    () => () => {
      frameMaterial.dispose();
      upperPanelMaterial.map?.dispose();
      upperPanelMaterial.dispose();
      lowerPanelMaterial.map?.dispose();
      lowerPanelMaterial.dispose();
      texture.dispose();
    },
    [frameMaterial, upperPanelMaterial, lowerPanelMaterial, texture]
  );

  const halfW = width / 2;
  const halfD = depth / 2;
  const backZ = -halfD + PANEL_THICKNESS / 2;
  const postX = halfW - POST_SIZE / 2;
  const postZ = -halfD + 3;
  const shelfZ = -halfD + SHELF_DEPTH / 2;

  const panels = [
    {
      width: width - POST_SIZE * 2,
      height: UPPER_PANEL_HEIGHT,
      centerY: UPPER_PANEL_BASE + UPPER_PANEL_HEIGHT / 2,
      material: upperPanelMaterial,
    },
    {
      width: width - POST_SIZE * 2,
      height: LOWER_PANEL_HEIGHT,
      centerY: LOWER_PANEL_BASE + LOWER_PANEL_HEIGHT / 2,
      material: lowerPanelMaterial,
    },
  ];

  return (
    <group onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
      <mesh position={[-postX, FRAME_HEIGHT / 2, postZ]} material={frameMaterial}>
        <boxGeometry args={[POST_SIZE, FRAME_HEIGHT, 6]} />
      </mesh>
      <mesh position={[postX, FRAME_HEIGHT / 2, postZ]} material={frameMaterial}>
        <boxGeometry args={[POST_SIZE, FRAME_HEIGHT, 6]} />
      </mesh>
      <mesh
        position={[0, FRAME_HEIGHT - SHELF_THICKNESS / 2, shelfZ]}
        material={frameMaterial}
      >
        <boxGeometry args={[width, SHELF_THICKNESS, SHELF_DEPTH]} />
      </mesh>
      <mesh position={[0, MID_SHELF_Y, shelfZ]} material={frameMaterial}>
        <boxGeometry args={[width, SHELF_THICKNESS, SHELF_DEPTH]} />
      </mesh>
      {panels.map((panel, index) => (
        <mesh
          key={`panel-${index}`}
          position={[0, panel.centerY, backZ]}
          material={panel.material}
        >
          <boxGeometry args={[panel.width, panel.height, PANEL_THICKNESS]} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh
          key={`feet-${side}`}
          position={[side * (halfW - 6), 1.5, -halfD + FEET_LENGTH / 2]}
          material={frameMaterial}
        >
          <boxGeometry args={[6, 3, FEET_LENGTH]} />
        </mesh>
      ))}
    </group>
  );
}
