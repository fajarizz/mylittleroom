"use client";

import { useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Grid, OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { RoomGrid, type RoomDimensions } from "./room-grid";
import { FloorLabels } from "./floor-labels";
import { CompassDial } from "./compass-dial";
import { RoomTools } from "./room-tools";

const DEFAULT_CAMERA_POSITION: [number, number, number] = [420, 330, 560];
const ROOM_CENTER: [number, number, number] = [0, 135, 0];

function CompassSync({
  dialRef,
}: {
  dialRef: React.RefObject<HTMLDivElement | null>;
}) {
  const controls = useThree((state) => state.controls) as
    | OrbitControlsImpl
    | null;

  useFrame(() => {
    if (!controls || !dialRef.current) return;
    const degrees = (controls.getAzimuthalAngle() * 180) / Math.PI;
    dialRef.current.style.transform = `rotate(${degrees}deg)`;
  });

  return null;
}

export function RoomViewer() {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const dialRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<RoomDimensions>({
    width: 240,
    depth: 270,
    height: 270,
  });
  const [autoRotate, setAutoRotate] = useState(false);

  const resetView = () => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.object.position.set(...DEFAULT_CAMERA_POSITION);
    controls.target.set(...ROOM_CENTER);
    controls.update();
  };

  return (
    <div className="fixed inset-0 bg-white">
      <Canvas
        camera={{
          position: DEFAULT_CAMERA_POSITION,
          fov: 40,
          near: 1,
          far: 8000,
        }}
        dpr={[1, 2]}
        gl={{ antialias: true }}
      >
        <color attach="background" args={["#ffffff"]} />
        <fog attach="fog" args={["#ffffff", 300, 2500]} />
        <RoomGrid dimensions={dimensions} />
        <FloorLabels dimensions={dimensions} />
        <Grid
          infiniteGrid
          cellSize={20}
          cellThickness={0.5}
          cellColor="#e4e4e7"
          sectionSize={100}
          sectionThickness={1}
          sectionColor="#d4d4d8"
          fadeDistance={5000}
          fadeFrom={2000}
        />
        <OrbitControls
          ref={controlsRef}
          makeDefault
          target={ROOM_CENTER}
          enableDamping
          autoRotate={autoRotate}
          autoRotateSpeed={0.8}
          minDistance={120}
          maxDistance={3000}
        />
        <CompassSync dialRef={dialRef} />
      </Canvas>
      <div className="absolute top-4 left-4 z-10 w-72">
        <RoomTools
          dimensions={dimensions}
          onDimensionsChange={setDimensions}
          autoRotate={autoRotate}
          onAutoRotateChange={setAutoRotate}
          onResetView={resetView}
        />
      </div>
      <div className="bg-background/80 absolute top-4 right-4 z-10 size-20 rounded-full border backdrop-blur-md">
        <div ref={dialRef} className="absolute inset-0 will-change-transform">
          <CompassDial />
        </div>
        <div className="absolute top-0.5 left-1/2 z-10 h-2 w-0.5 -translate-x-1/2 rounded-full bg-zinc-900" />
      </div>
    </div>
  );
}
