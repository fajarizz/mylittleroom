import { useEffect, useMemo, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export type RoomDimensions = {
  width: number;
  depth: number;
  height: number;
};

const DOOR_WIDTH = 80;
const DOOR_HEIGHT = 200;
const DOOR_FROM_SOUTH = 100;

type LinePusher = (
  from: [number, number, number],
  to: [number, number, number]
) => void;

function buildFaceGeometry(build: (push: LinePusher) => void) {
  const points: number[] = [];
  build((from, to) => points.push(...from, ...to));

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(points), 3)
  );

  const distances = new Float32Array(points.length / 3);
  for (let segment = 0; segment < distances.length / 2; segment++) {
    const start = segment * 2;
    const end = start + 1;
    const dx = points[end * 3] - points[start * 3];
    const dy = points[end * 3 + 1] - points[start * 3 + 1];
    const dz = points[end * 3 + 2] - points[start * 3 + 2];
    distances[start] = 0;
    distances[end] = Math.hypot(dx, dy, dz);
  }
  geometry.setAttribute(
    "lineDistance",
    new THREE.BufferAttribute(distances, 1)
  );

  return geometry;
}

function doorOpening({
  depth,
  height,
}: {
  depth: number;
  height: number;
}) {
  const maxZ = depth / 2 - DOOR_FROM_SOUTH;
  return {
    minZ: maxZ - DOOR_WIDTH,
    maxZ,
    top: Math.min(DOOR_HEIGHT, height),
  };
}

function buildRoomFaces({ width, depth, height }: RoomDimensions, step: number) {
  const halfW = width / 2;
  const halfD = depth / 2;
  const halfH = height / 2;

  const floor = buildFaceGeometry((push) => {
    for (let x = -halfW + step; x < halfW - 0.001; x += step) {
      push([x, 0, -halfD], [x, 0, halfD]);
    }
    for (let z = -halfD + step; z < halfD - 0.001; z += step) {
      push([-halfW, 0, z], [halfW, 0, z]);
    }
    push([-halfW, 0, -halfD], [halfW, 0, -halfD]);
    push([-halfW, 0, halfD], [halfW, 0, halfD]);
    push([-halfW, 0, -halfD], [-halfW, 0, halfD]);
    push([halfW, 0, -halfD], [halfW, 0, halfD]);
  });

  const wallX = buildFaceGeometry((push) => {
    for (let z = -halfD + step; z < halfD - 0.001; z += step) {
      push([0, -halfH, z], [0, halfH, z]);
    }
    for (let y = -halfH + step; y < halfH - 0.001; y += step) {
      push([0, y, -halfD], [0, y, halfD]);
    }
    push([0, -halfH, -halfD], [0, -halfH, halfD]);
    push([0, halfH, -halfD], [0, halfH, halfD]);
    push([0, -halfH, -halfD], [0, halfH, -halfD]);
    push([0, -halfH, halfD], [0, halfH, halfD]);
  });

  const wallZ = buildFaceGeometry((push) => {
    for (let x = -halfW + step; x < halfW - 0.001; x += step) {
      push([x, -halfH, 0], [x, halfH, 0]);
    }
    for (let y = -halfH + step; y < halfH - 0.001; y += step) {
      push([-halfW, y, 0], [halfW, y, 0]);
    }
    push([-halfW, -halfH, 0], [halfW, -halfH, 0]);
    push([-halfW, halfH, 0], [halfW, halfH, 0]);
    push([-halfW, -halfH, 0], [-halfW, halfH, 0]);
    push([halfW, -halfH, 0], [halfW, halfH, 0]);
  });

  const eastWall = buildFaceGeometry((push) => {
    const door = doorOpening({ depth, height });
    const doorTopLocal = door.top - halfH;

    for (let z = -halfD + step; z < halfD - 0.001; z += step) {
      const inDoor = z > door.minZ + 0.001 && z < door.maxZ - 0.001;
      if (inDoor) {
        push([0, doorTopLocal, z], [0, halfH, z]);
      } else {
        push([0, -halfH, z], [0, halfH, z]);
      }
    }
    for (let y = -halfH + step; y < halfH - 0.001; y += step) {
      if (y > -halfH + 0.001 && y < doorTopLocal - 0.001) {
        push([0, y, -halfD], [0, y, door.minZ]);
        push([0, y, door.maxZ], [0, y, halfD]);
      } else {
        push([0, y, -halfD], [0, y, halfD]);
      }
    }
    push([0, -halfH, -halfD], [0, -halfH, halfD]);
    push([0, halfH, -halfD], [0, halfH, halfD]);
    push([0, -halfH, -halfD], [0, halfH, -halfD]);
    push([0, -halfH, halfD], [0, halfH, halfD]);
    push([0, -halfH, door.minZ], [0, doorTopLocal, door.minZ]);
    push([0, -halfH, door.maxZ], [0, doorTopLocal, door.maxZ]);
    push([0, doorTopLocal, door.minZ], [0, doorTopLocal, door.maxZ]);
  });

  return { floor, wallX, eastWall, wallZ };
}

function applyCenterFog(
  material: THREE.Material,
  fogCenter: { value: THREE.Vector3 }
) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.fogCenter = fogCenter;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform vec3 fogCenter;"
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvec4 cFogWorld = modelMatrix * vec4(transformed, 1.0);"
      )
      .replace(
        "#include <fog_vertex>",
        "vFogDepth = distance(cFogWorld.xyz, fogCenter);"
      );
  };
  material.customProgramCacheKey = () => "center-distance-fog";
}

type OcclusionTest = (cameraPosition: THREE.Vector3) => boolean;

function DoorOutline({
  dimensions,
  fogCenter,
}: {
  dimensions: RoomDimensions;
  fogCenter: { value: THREE.Vector3 };
}) {
  const geometry = useMemo(
    () => {
      const halfH = dimensions.height / 2;
      const door = doorOpening(dimensions);
      const doorTopLocal = door.top - halfH;
      return buildFaceGeometry((push) => {
        push([0, -halfH, door.minZ], [0, doorTopLocal, door.minZ]);
        push([0, -halfH, door.maxZ], [0, doorTopLocal, door.maxZ]);
        push([0, doorTopLocal, door.minZ], [0, doorTopLocal, door.maxZ]);
        push([0, -halfH, door.minZ], [0, -halfH, door.maxZ]);
      });
    },
    [dimensions]
  );

  const baseDistances = useMemo(() => {
    const attribute = geometry.getAttribute("lineDistance");
    return Float32Array.from(attribute.array as Float32Array);
  }, [geometry]);

  const material = useMemo(
    () =>
      new THREE.LineDashedMaterial({
        color: "#3f3f46",
        dashSize: 6,
        gapSize: 4,
        transparent: true,
        opacity: 0.9,
      }),
    []
  );

  useEffect(() => applyCenterFog(material, fogCenter), [material, fogCenter]);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material]
  );

  useFrame(({ clock }) => {
    const attribute = geometry.getAttribute("lineDistance");
    const array = attribute.array as Float32Array;
    const offset = clock.getElapsedTime() * 8;
    for (let i = 0; i < array.length; i++) {
      array[i] = baseDistances[i] - offset;
    }
    attribute.needsUpdate = true;
  });

  return (
    <lineSegments geometry={geometry} position={[dimensions.width / 2, 0, 0]}>
      <primitive object={material} attach="material" />
    </lineSegments>
  );
}

function FadingFace({
  geometry,
  position,
  isOccluding,
  basicMaterial,
  dashedMaterial,
}: {
  geometry: THREE.BufferGeometry;
  position: [number, number, number];
  isOccluding: OcclusionTest;
  basicMaterial: THREE.Material;
  dashedMaterial: THREE.Material;
}) {
  const [occluded, setOccluded] = useState(false);

  useFrame(({ camera }) => {
    const next = isOccluding(camera.position);
    if (next !== occluded) setOccluded(next);
  });

  return (
    <lineSegments geometry={geometry} position={position}>
      <primitive
        key={occluded ? "dashed" : "basic"}
        object={occluded ? dashedMaterial : basicMaterial}
        attach="material"
      />
    </lineSegments>
  );
}

export function RoomGrid({
  dimensions,
  step = 20,
}: {
  dimensions: RoomDimensions;
  step?: number;
}) {
  const faces = useMemo(
    () => buildRoomFaces(dimensions, step),
    [dimensions, step]
  );

  const fogCenter = useMemo(
    () => ({ value: new THREE.Vector3(0, dimensions.height / 2, 0) }),
    []
  );
  useEffect(() => {
    fogCenter.value.set(0, dimensions.height / 2, 0);
  }, [dimensions.height, fogCenter]);

  const { basicMaterial, dashedMaterial } = useMemo(() => {
    const basicMaterial = new THREE.LineBasicMaterial({
      color: "#d4d4d8",
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    const dashedMaterial = new THREE.LineDashedMaterial({
      color: "#d4d4d8",
      transparent: true,
      opacity: 0.15,
      dashSize: 5,
      gapSize: 4,
      depthWrite: false,
    });
    applyCenterFog(basicMaterial, fogCenter);
    applyCenterFog(dashedMaterial, fogCenter);
    return { basicMaterial, dashedMaterial };
  }, [fogCenter]);

  useEffect(
    () => () => {
      basicMaterial.dispose();
      dashedMaterial.dispose();
    },
    [basicMaterial, dashedMaterial]
  );
  useEffect(
    () => () => {
      Object.values(faces).forEach((geometry) => geometry.dispose());
    },
    [faces]
  );

  const halfW = dimensions.width / 2;
  const halfD = dimensions.depth / 2;
  const halfH = dimensions.height / 2;

  const faceProps = { basicMaterial, dashedMaterial };

  return (
    <group position={[0, halfH, 0]}>
      <FadingFace
        geometry={faces.floor}
        position={[0, -halfH, 0]}
        isOccluding={(p) => p.y < 0}
        {...faceProps}
      />
      <FadingFace
        geometry={faces.eastWall}
        position={[halfW, 0, 0]}
        isOccluding={(p) => p.x > halfW}
        {...faceProps}
      />
      <FadingFace
        geometry={faces.wallX}
        position={[-halfW, 0, 0]}
        isOccluding={(p) => p.x < -halfW}
        {...faceProps}
      />
      <FadingFace
        geometry={faces.wallZ}
        position={[0, 0, halfD]}
        isOccluding={(p) => p.z > halfD}
        {...faceProps}
      />
      <FadingFace
        geometry={faces.wallZ}
        position={[0, 0, -halfD]}
        isOccluding={(p) => p.z < -halfD}
        {...faceProps}
      />
      <DoorOutline dimensions={dimensions} fogCenter={fogCenter} />
    </group>
  );
}
