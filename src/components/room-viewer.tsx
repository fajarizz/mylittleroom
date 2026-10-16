"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { RoomGrid, type RoomDimensions } from "./room-grid";
import { FloorLabels, cellAddresses, cellAt } from "./floor-labels";
import {
  FloorSelection,
  cellRect,
  MarchingRectangle,
  type CellSelection,
} from "./floor-selection";
import { Table } from "./table";
import { Wardrobe } from "./wardrobe";
import { LoftBed } from "./loft-bed";
import { Pegboard } from "./pegboard";
import { Carpet } from "./carpet";
import { Rack } from "./rack";
import { CubbyStack } from "./cubby";
import { WestWallLabels, WestWallHighlight } from "./wall-labels";
import {
  INITIAL_PIECES,
  parsePieceList,
  pieceBaseSize,
  PIECE_SPECS,
  pieceFootprint,
  resolvePegboardWidth,
  snapToGrid,
  type FurniturePiece,
  type PieceKind,
} from "./furniture";
import { CompassDial } from "./compass-dial";
import { PEGBOARD_WIDTHS } from "./furniture";
import { RoomTools } from "./room-tools";
import { Button } from "@/components/ui/button";

const DEFAULT_CAMERA_POSITION: [number, number, number] = [420, 330, 560];
const ROOM_CENTER: [number, number, number] = [0, 135, 0];

const STEP = 10;
const CAMERA_SPEED = 320;

function isEditableTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "BUTTON" ||
      target.tagName === "SELECT" ||
      target.isContentEditable)
  );
}

function WasdMove({ keys }: { keys: React.RefObject<Set<string>> }) {
  const controls = useThree((state) => state.controls) as
    | OrbitControlsImpl
    | null;

  useFrame((_, delta) => {
    if (!controls || !keys.current || keys.current.size === 0) return;
    const camera = controls.object;
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) return;
    forward.normalize();
    const right = new THREE.Vector3(-forward.z, 0, forward.x);

    const move = new THREE.Vector3();
    if (keys.current.has("w")) move.add(forward);
    if (keys.current.has("s")) move.sub(forward);
    if (keys.current.has("d")) move.add(right);
    if (keys.current.has("a")) move.sub(right);
    if (move.lengthSq() === 0) return;

    move.normalize().multiplyScalar(CAMERA_SPEED * delta);
    camera.position.add(move);
    controls.target.add(move);
    controls.update();
  });

  return null;
}

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

function SmoothPiece({
  x,
  z,
  rotations,
  children,
}: {
  x: number;
  z: number;
  rotations: number;
  children: React.ReactNode;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const targetRef = useRef({ x, z, rot: (rotations * Math.PI) / 2 });
  targetRef.current = { x, z, rot: (rotations * Math.PI) / 2 };
  const initialized = useRef(false);

  useEffect(() => {
    const group = groupRef.current;
    if (group && !initialized.current) {
      group.position.set(targetRef.current.x, 0, targetRef.current.z);
      group.rotation.y = targetRef.current.rot;
      initialized.current = true;
    }
  });

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const t = 1 - Math.exp(-16 * delta);
    group.position.x += (targetRef.current.x - group.position.x) * t;
    group.position.z += (targetRef.current.z - group.position.z) * t;
    let diff = targetRef.current.rot - group.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    group.rotation.y += diff * t;
  });

  return <group ref={groupRef}>{children}</group>;
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
  const [selection, setSelection] = useState<CellSelection | null>(null);
  const [pieces, setPieces] = useState<FurniturePiece[]>(INITIAL_PIECES);
  const configLoaded = useRef(false);
  useEffect(() => {
    if (configLoaded.current) return;
    configLoaded.current = true;
    fetch("/api/furniture")
      .then((response) => response.json())
      .then((data) => {
        const pieces = parsePieceList((data as { pieces?: unknown }).pieces);
        if (pieces.length > 0) setPieces(pieces);
      })
      .catch(() => undefined);
  }, []);
  const [activePieceId, setActivePieceId] = useState<PieceKind | null>(null);
  const [cursorTip, setCursorTip] = useState<{
    x: number;
    y: number;
    label: string;
  } | null>(null);
  const dragRef = useRef<{ id: PieceKind; grabX: number; grabZ: number } | null>(
    null
  );
  const pieceDownRef = useRef<{ x: number; y: number } | null>(null);
  const heldKeysRef = useRef(new Set<string>());

  const addresses = useMemo(() => cellAddresses(dimensions, 10), [dimensions]);

  const fogCenter = useMemo(
    () => ({ value: new THREE.Vector3(0, dimensions.height / 2, 0) }),
    []
  );
  useEffect(() => {
    fogCenter.value.set(0, dimensions.height / 2, 0);
  }, [dimensions.height, fogCenter]);

  useEffect(() => {
    setSelection(null);
    setActivePieceId(null);
    const minX = addresses.boundsX[0];
    const maxX = addresses.boundsX[addresses.boundsX.length - 1];
    const minZ = addresses.boundsZ[0];
    const maxZ = addresses.boundsZ[addresses.boundsZ.length - 1];
    setPieces((prev) =>
      prev.map((piece) => {
        const footprint = pieceFootprint(piece);
        let x0 = piece.x0;
        let z0 = piece.z0;
        let clamped = false;
        if (footprint.x1 > maxX) {
          x0 = snapToGrid(maxX - footprint.width, minX);
          clamped = true;
        }
        if (x0 < minX) {
          x0 = minX;
          clamped = true;
        }
        if (footprint.z1 > maxZ) {
          z0 = snapToGrid(maxZ - footprint.depth, minZ);
          clamped = true;
        }
        if (z0 < minZ) {
          z0 = minZ;
          clamped = true;
        }
        return clamped ? { ...piece, x0, z0 } : piece;
      })
    );
  }, [dimensions, addresses]);

  const resetView = useCallback(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.object.position.set(...DEFAULT_CAMERA_POSITION);
    controls.target.set(...ROOM_CENTER);
    controls.update();
  }, []);

  const popupMeta = useMemo(() => {
    if (!selection) return null;
    const rect = cellRect(selection, addresses);
    if (!rect) return null;
    return {
      ...rect,
      width: rect.to[0] - rect.from[0],
      depth: rect.to[1] - rect.from[1],
    };
  }, [selection, addresses]);

  const handlePiecePointerDown = useCallback(
    (piece: FurniturePiece, event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      pieceDownRef.current = {
        x: event.nativeEvent.clientX,
        y: event.nativeEvent.clientY,
      };
      if (activePieceId !== piece.id) return;
      const footprint = pieceFootprint(piece);
      if (controlsRef.current) controlsRef.current.enabled = false;
      dragRef.current = {
        id: piece.id,
        grabX: event.point.x - footprint.x0,
        grabZ: event.point.z - footprint.z0,
      };
    },
    [activePieceId]
  );

  const handlePiecePointerUp = useCallback(
    (piece: FurniturePiece, event: ThreeEvent<PointerEvent>) => {
      const wasDragging = dragRef.current !== null;
      dragRef.current = null;
      if (wasDragging && controlsRef.current) controlsRef.current.enabled = true;
      const down = pieceDownRef.current;
      pieceDownRef.current = null;
      if (!down) return;
      const moved = Math.hypot(
        event.nativeEvent.clientX - down.x,
        event.nativeEvent.clientY - down.y
      );
      if (moved > 4) return;
      const next = activePieceId === piece.id ? null : piece.id;
      setActivePieceId(next);
      setCursorTip(
        next
          ? { x: event.nativeEvent.clientX, y: event.nativeEvent.clientY, label: PIECE_SPECS[piece.id].label }
          : null
      );
      setSelection(null);
    },
    [activePieceId]
  );

  const handleFloorPointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      const drag = dragRef.current;
      if (!drag) return;
      setCursorTip(null);
      const maxX = addresses.boundsX[addresses.boundsX.length - 1];
      const minZ = addresses.boundsZ[0];
      const maxZ = addresses.boundsZ[addresses.boundsZ.length - 1];
      setPieces((prev) =>
        prev.map((piece) => {
          if (piece.id !== drag.id) return piece;
          const footprint = pieceFootprint(piece);
          const x0 = snapToGrid(
            event.point.x - drag.grabX,
            addresses.boundsX[0]
          );
          const z0 = snapToGrid(event.point.z - drag.grabZ, minZ);
          return {
            ...piece,
            x0: Math.min(Math.max(x0, addresses.boundsX[0]), maxX - footprint.width),
            z0: Math.min(Math.max(z0, minZ), maxZ - footprint.depth),
          };
        })
      );
      setActivePieceId(drag.id);
    },
    [addresses]
  );

  const handleFloorPointerUp = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    pieceDownRef.current = null;
    if (controlsRef.current) controlsRef.current.enabled = true;
  }, []);

  const movePieceWithArrow = useCallback(
    (key: string) => {
      if (!activePieceId) return;
      const camera = controlsRef.current?.object;
      if (!camera) return;
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      forward.y = 0;
      if (forward.lengthSq() < 1e-6) return;
      forward.normalize();

      const forwardSign = key === "ArrowUp" ? 1 : key === "ArrowDown" ? -1 : 0;
      const rightSign = key === "ArrowRight" ? 1 : key === "ArrowLeft" ? -1 : 0;

      let dx = 0;
      let dz = 0;
      if (forwardSign !== 0) {
        if (Math.abs(forward.x) >= Math.abs(forward.z)) {
          dx = forwardSign * Math.sign(forward.x);
        } else {
          dz = forwardSign * Math.sign(forward.z);
        }
      }
      if (rightSign !== 0) {
        const right = new THREE.Vector3(-forward.z, 0, forward.x);
        if (Math.abs(right.x) >= Math.abs(right.z)) {
          dx = rightSign * Math.sign(right.x);
        } else {
          dz = rightSign * Math.sign(right.z);
        }
      }
      if (dx === 0 && dz === 0) return;

      setPieces((prev) =>
        prev.map((piece) => {
          if (piece.id !== activePieceId) return piece;
          const footprint = pieceFootprint(piece);
          const x0 = Math.min(
            Math.max(piece.x0 + dx * STEP, addresses.boundsX[0]),
            addresses.boundsX[addresses.boundsX.length - 1] - footprint.width
          );
          const z0 = Math.min(
            Math.max(piece.z0 + dz * STEP, addresses.boundsZ[0]),
            addresses.boundsZ[addresses.boundsZ.length - 1] - footprint.depth
          );
          return { ...piece, x0, z0 };
        })
      );
    },
    [activePieceId, addresses]
  );

  useEffect(() => {
    const onPointerEnded = () => handleFloorPointerUp();
    window.addEventListener("pointerup", onPointerEnded);
    window.addEventListener("pointercancel", onPointerEnded);
    return () => {
      window.removeEventListener("pointerup", onPointerEnded);
      window.removeEventListener("pointercancel", onPointerEnded);
    };
  }, [handleFloorPointerUp]);

  const rotatePiece = useCallback((id: PieceKind) => {
    setPieces((prev) =>
      prev.map((piece) => {
        if (piece.id !== id) return piece;
        const base = pieceBaseSize(piece);
        const footprint = pieceFootprint(piece);
        const centerX = footprint.x0 + footprint.width / 2;
        const centerZ = footprint.z0 + footprint.depth / 2;
        const rotations = (piece.rotations + 1) % 4;
        const swapped = rotations % 2 === 1;
        const width = swapped ? base.depth : base.width;
        const depth = swapped ? base.width : base.depth;
        return {
          ...piece,
          rotations,
          x0: snapToGrid(centerX - width / 2, addresses.boundsX[0]),
          z0: snapToGrid(centerZ - depth / 2, addresses.boundsZ[0]),
        };
      })
    );
  }, [addresses]);

  const saveLayout = useCallback(async () => {
    await fetch("/api/furniture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pieces }),
    });
  }, [pieces]);

  useEffect(() => {
    const heldKeys = heldKeysRef.current;
    const isEditable = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return true;
      return (
        event.target instanceof HTMLElement &&
        (event.target.tagName === "INPUT" ||
          event.target.tagName === "TEXTAREA" ||
          event.target.isContentEditable)
      );
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditable(event)) return;
      const key = event.key.toLowerCase();
      if ("wasd".includes(key)) heldKeys.add(key);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      heldKeys.delete(event.key.toLowerCase());
    };
    const onBlur = () => heldKeys.clear();
    const onArrowKey = (event: KeyboardEvent) => {
      if (isEditable(event)) return;
      if (!event.key.startsWith("Arrow")) return;
      event.preventDefault();
      movePieceWithArrow(event.key);
    };
    const onRotateKey = (event: KeyboardEvent) => {
      if (isEditable(event)) return;
      if (event.key.toLowerCase() !== "r") return;
      if (activePieceId) rotatePiece(activePieceId);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("keydown", onArrowKey);
    window.addEventListener("keydown", onRotateKey);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("keydown", onArrowKey);
      window.removeEventListener("keydown", onRotateKey);
      window.removeEventListener("blur", onBlur);
    };
  }, [movePieceWithArrow, activePieceId, rotatePiece]);

  const activePiece = useMemo(
    () => (activePieceId ? pieces.find((p) => p.id === activePieceId) : undefined),
    [activePieceId, pieces]
  );
  const activePieceFootprint = useMemo(
    () => (activePiece ? pieceFootprint(activePiece) : null),
    [activePiece]
  );

  const pieceMeta = useMemo(() => {
    if (!activePiece) return null;
    const footprint = pieceFootprint(activePiece);
    const spec = PIECE_SPECS[activePiece.id];
    const from = cellAt(
      addresses,
      footprint.x0 + 0.01,
      footprint.z0 + 0.01
    );
    const to = cellAt(
      addresses,
      footprint.x1 - 0.01,
      footprint.z1 - 0.01
    );
    return {
      kind: activePiece.id,
      label: spec.label,
      height: spec.height,
      width: footprint.width,
      depth: footprint.depth,
      variant:
        activePiece.id === "pegboard" ? resolvePegboardWidth(activePiece.variant) : null,
      fromName: from?.name ?? "—",
      toName: to?.name ?? "—",
      from: [footprint.x0, footprint.z0] as [number, number],
      to: [footprint.x1, footprint.z1] as [number, number],
    };
  }, [activePiece, addresses]);

  const changePegboardWidth = useCallback(
    (variant: number) => {
      setPieces((prev) =>
        prev.map((piece) => {
          if (piece.id !== "pegboard") return piece;
          const base = pieceBaseSize({ ...piece, variant });
          const next = { ...piece, variant };
          const footprint = pieceFootprint(next);
          let x0 = piece.x0;
          let z0 = piece.z0;
          if (footprint.x1 > addresses.boundsX[addresses.boundsX.length - 1]) {
            x0 = addresses.boundsX[addresses.boundsX.length - 1] - base.width;
          }
          if (footprint.z1 > addresses.boundsZ[addresses.boundsZ.length - 1]) {
            z0 = addresses.boundsZ[addresses.boundsZ.length - 1] - base.depth;
          }
          return {
            ...next,
            x0: snapToGrid(x0, addresses.boundsX[0]),
            z0: snapToGrid(z0, addresses.boundsZ[0]),
          };
        })
      );
    },
    [addresses]
  );

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
        <ambientLight intensity={0.9} />
        <hemisphereLight args={["#ffffff", "#e4e4e7", 1.2]} />
        <directionalLight position={[300, 500, 200]} intensity={1.2} />
        <RoomGrid dimensions={dimensions} fogCenter={fogCenter} />
        {pieces.map((piece) => {
          const base = pieceBaseSize(piece);
          const footprint = pieceFootprint(piece);
          const highlighted = activePieceId === piece.id;
          const shape =
            piece.id === "table" ? (
              <Table
                width={base.width}
                depth={base.depth}
                highlighted={highlighted}
                fogCenter={fogCenter}
                onPointerDown={(event) => handlePiecePointerDown(piece, event)}
                onPointerUp={(event) => handlePiecePointerUp(piece, event)}
              />
            ) : piece.id === "loftBed" ? (
              <LoftBed
                width={base.width}
                depth={base.depth}
                highlighted={highlighted}
                fogCenter={fogCenter}
                onPointerDown={(event) => handlePiecePointerDown(piece, event)}
                onPointerUp={(event) => handlePiecePointerUp(piece, event)}
              />
            ) : piece.id === "pegboard" ? (
              <Pegboard
                width={base.width}
                depth={base.depth}
                highlighted={highlighted}
                fogCenter={fogCenter}
                onPointerDown={(event) => handlePiecePointerDown(piece, event)}
                onPointerUp={(event) => handlePiecePointerUp(piece, event)}
              />
            ) : piece.id === "carpet" ? (
              <Carpet
                width={base.width}
                depth={base.depth}
                highlighted={highlighted}
                fogCenter={fogCenter}
                onPointerDown={(event) => handlePiecePointerDown(piece, event)}
                onPointerUp={(event) => handlePiecePointerUp(piece, event)}
              />
            ) : piece.id === "rack" ? (
              <Rack
                width={base.width}
                depth={base.depth}
                highlighted={highlighted}
                fogCenter={fogCenter}
                onPointerDown={(event) => handlePiecePointerDown(piece, event)}
                onPointerUp={(event) => handlePiecePointerUp(piece, event)}
              />
            ) : piece.id === "cubby" ? (
              <CubbyStack
                width={base.width}
                depth={base.depth}
                highlighted={highlighted}
                fogCenter={fogCenter}
                onPointerDown={(event) => handlePiecePointerDown(piece, event)}
                onPointerUp={(event) => handlePiecePointerUp(piece, event)}
              />
            ) : (
              <Wardrobe
                width={base.width}
                depth={base.depth}
                highlighted={highlighted}
                fogCenter={fogCenter}
                onPointerDown={(event) => handlePiecePointerDown(piece, event)}
                onPointerUp={(event) => handlePiecePointerUp(piece, event)}
              />
            );
          return (
            <SmoothPiece
              key={piece.id}
              x={footprint.x0 + footprint.width / 2}
              z={footprint.z0 + footprint.depth / 2}
              rotations={piece.rotations}
            >
              {shape}
            </SmoothPiece>
          );
        })}
        {activePieceFootprint && (
          <MarchingRectangle
            x0={activePieceFootprint.x0}
            x1={activePieceFootprint.x1}
            z0={activePieceFootprint.z0}
            z1={activePieceFootprint.z1}
            y={0.55}
            color="#52525b"
            fogCenter={fogCenter}
          />
        )}
        <FloorLabels dimensions={dimensions} />
        <WestWallLabels dimensions={dimensions} />
        <WestWallHighlight dimensions={dimensions} fogCenter={fogCenter} />
        <FloorSelection
          dimensions={dimensions}
          step={10}
          fogCenter={fogCenter}
          selection={selection}
          onSelect={(cell) => {
            setSelection(cell);
            setCursorTip(null);
            if (cell) setActivePieceId(null);
          }}
          onFloorPointerMove={handleFloorPointerMove}
          onFloorPointerUp={handleFloorPointerUp}
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
        <WasdMove keys={heldKeysRef} />
      </Canvas>
      <div className="absolute left-4 top-4 z-10 flex w-72 flex-col gap-3">
        <RoomTools
          dimensions={dimensions}
          onDimensionsChange={setDimensions}
          autoRotate={autoRotate}
          onAutoRotateChange={setAutoRotate}
          onResetView={resetView}
          onSaveLayout={saveLayout}
        />
        {pieceMeta && (
          <PiecePopup
            meta={pieceMeta}
            onRotate={() => rotatePiece(pieceMeta.kind)}
            onVariant={pieceMeta.variant !== null ? changePegboardWidth : undefined}
          />
        )}
      </div>
      <div className="bg-background/90 absolute top-4 right-4 z-10 size-20 rounded-full border">
        <div ref={dialRef} className="absolute inset-0 will-change-transform">
          <CompassDial />
        </div>
        <div className="absolute top-0.5 left-1/2 z-10 h-2 w-0.5 -translate-x-1/2 rounded-full bg-zinc-900" />
      </div>
      {popupMeta && (
        <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2">
          <CellPopup selectionMeta={popupMeta} />
        </div>
      )}
      {cursorTip && (
        <div
          className="pointer-events-none fixed z-30 -translate-x-1/2 rounded-md bg-zinc-900 px-2 py-1 text-xs text-white"
          style={{ left: cursorTip.x, top: cursorTip.y + 16 }}
        >
          {cursorTip.label}
        </div>
      )}
    </div>
  );
}

function CellPopup({
  selectionMeta,
}: {
  selectionMeta: {
    name: string;
    from: [number, number];
    to: [number, number];
    width: number;
    depth: number;
  };
}) {
  return (
    <div className="bg-background/90 rounded-2xl border px-5 py-3 text-center">
      <p className="text-lg font-semibold">{selectionMeta.name}</p>
      <p className="text-muted-foreground text-sm">
        from ({selectionMeta.from.join(", ")}) to ({selectionMeta.to.join(", ")})
      </p>
      <p className="text-muted-foreground text-xs">
        {selectionMeta.width} × {selectionMeta.depth} cm range
      </p>
    </div>
  );
}

function PiecePopup({
  meta,
  onRotate,
  onVariant,
}: {
  meta: {
    kind: PieceKind;
    label: string;
    height: number;
    width: number;
    depth: number;
    variant: number | null;
    fromName: string;
    toName: string;
    from: [number, number];
    to: [number, number];
  };
  onRotate: () => void;
  onVariant?: (variant: number) => void;
}) {
  return (
    <div className="bg-background/90 rounded-2xl border px-5 py-3">
      <p className="text-center text-lg font-semibold">{meta.label}</p>
      <p className="text-muted-foreground text-center text-sm">
        {meta.fromName} → {meta.toName} · {meta.width} × {meta.height} ×
        {` ${meta.depth}`} cm
      </p>
      {meta.variant !== null && (
        <div className="mt-2 flex items-center justify-center gap-2">
          <span className="text-muted-foreground text-xs">Width</span>
          {PEGBOARD_WIDTHS.map((width) => (
            <Button
              key={width}
              size="sm"
              variant={meta.variant === width ? "default" : "outline"}
              onClick={() => onVariant?.(width)}
            >
              {width}
            </Button>
          ))}
        </div>
      )}
      <div className="mt-2 flex items-center justify-center">
        <Button size="sm" onClick={onRotate} className="w-full">
          Rotate 90°
        </Button>
      </div>
    </div>
  );
}
