"use client";

import { memo, useEffect, useMemo } from "react";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import {
  applyCenterFog,
  buildFaceGeometry,
  type RoomDimensions,
} from "./room-grid";
import { cellAddresses } from "./floor-labels";
import { useMarchingDashes } from "./floor-selection";

function heightLevelBounds(height: number, step: number) {
  const bounds: number[] = [0];
  let y = 0;
  while (y < height - 0.001) {
    y = Math.min(y + step, height);
    bounds.push(y);
  }
  return bounds;
}

export const WestWallLabels = memo(function WestWallLabels({
  dimensions,
  step = 10,
}: {
  dimensions: RoomDimensions;
  step?: number;
}) {
  const halfW = dimensions.width / 2;
  const halfD = dimensions.depth / 2;
  const bounds = heightLevelBounds(dimensions.height, step);
  const labelX = -halfW + 0.6;

  return (
    <group>
      {[-halfD - 9, halfD + 9].map((z) =>
        bounds.slice(0, -1).map((level, index) => (
          <Text
            key={`wall-level-${z}-${index}`}
            position={[labelX, (level + bounds[index + 1]) / 2, z]}
            rotation={[0, Math.PI / 2, 0]}
            fontSize={5.5}
            color="#a1a1aa"
            anchorX="center"
            anchorY="middle"
          >
            {`H${index + 1}`}
          </Text>
        ))
      )}
    </group>
  );
});

const WALL_SELECTION = {
  rowFrom: "3",
  rowTo: "9",
  levelFrom: 11,
  levelTo: 14,
};

export const WestWallHighlight = memo(function WestWallHighlight({
  dimensions,
  step = 10,
  fogCenter,
}: {
  dimensions: RoomDimensions;
  step?: number;
  fogCenter: { value: THREE.Vector3 };
}) {
  const addresses = useMemo(
    () => cellAddresses(dimensions, step),
    [dimensions, step]
  );

  const geometry = useMemo(() => {
    const halfW = dimensions.width / 2;
    const northZ =
      addresses.boundsZ[addresses.rowIndex(WALL_SELECTION.rowFrom)];
    const southZ =
      addresses.boundsZ[addresses.rowIndex(WALL_SELECTION.rowTo) + 1];
    const bottomY = (WALL_SELECTION.levelFrom - 1) * step;
    const topY = WALL_SELECTION.levelTo * step;
    const x = -halfW + 0.2;
    return buildFaceGeometry((push) => {
      push([x, bottomY, northZ], [x, bottomY, southZ]);
      push([x, topY, northZ], [x, topY, southZ]);
      push([x, bottomY, northZ], [x, topY, northZ]);
      push([x, bottomY, southZ], [x, topY, southZ]);
    });
  }, [addresses, dimensions.width, step]);

  useMarchingDashes(geometry);

  const material = useMemo(
    () =>
      new THREE.LineDashedMaterial({
        color: "#3f3f46",
        dashSize: 4,
        gapSize: 3,
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

  return <lineSegments geometry={geometry} />;
});
