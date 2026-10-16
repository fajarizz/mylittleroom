"use client";

import { memo, useState } from "react";
import type { RoomDimensions } from "./room-grid";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const DEFAULT_DIMENSIONS: RoomDimensions = {
  width: 240,
  depth: 270,
  height: 270,
};

export const RoomTools = memo(function RoomTools({
  dimensions,
  onDimensionsChange,
  autoRotate,
  onAutoRotateChange,
  onResetView,
  onSaveLayout,
}: {
  dimensions: RoomDimensions;
  onDimensionsChange: (dimensions: RoomDimensions) => void;
  autoRotate: boolean;
  onAutoRotateChange: (autoRotate: boolean) => void;
  onResetView: () => void;
  onSaveLayout: () => Promise<void>;
}) {
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle"
  );

  const handleSave = async () => {
    setSaveState("saving");
    try {
      await onSaveLayout();
      setSaveState("saved");
    } finally {
      setTimeout(() => setSaveState("idle"), 1800);
    }
  };
  const sliders = [
    { key: "width", label: "Width" },
    { key: "depth", label: "Depth" },
    { key: "height", label: "Height" },
  ] as const;

  return (
    <Tabs
      defaultValue="view"
      className="bg-background/90 rounded-2xl border p-4 shadow-none"
    >
      <TabsList className="w-full">
        <TabsTrigger value="view" className="flex-1">
          View
        </TabsTrigger>
        <TabsTrigger value="room" className="flex-1">
          Room
        </TabsTrigger>
        <TabsTrigger value="info" className="flex-1">
          Info
        </TabsTrigger>
      </TabsList>
      <TabsContent value="view" className="flex flex-col gap-4 pt-4">
        <div className="flex items-center justify-between gap-6">
          <Label htmlFor="auto-rotate">Auto orbit</Label>
          <Switch
            id="auto-rotate"
            checked={autoRotate}
            onCheckedChange={onAutoRotateChange}
          />
        </div>
        <Separator />
        <Button variant="outline" onClick={onResetView}>
          Reset view
        </Button>
        <Button onClick={handleSave} disabled={saveState === "saving"}>
          {saveState === "saved"
            ? "Saved ✓"
            : saveState === "saving"
              ? "Saving…"
              : "Save furniture layout"}
        </Button>
      </TabsContent>
      <TabsContent value="room" className="flex flex-col gap-5 pt-4">
        {sliders.map(({ key, label }) => (
          <div key={key} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor={`room-${key}`}>{label}</Label>
              <span className="text-muted-foreground text-sm tabular-nums">
                {dimensions[key]} cm
              </span>
            </div>
            <Slider
              id={`room-${key}`}
              min={50}
              max={300}
              step={5}
              value={[dimensions[key]]}
              onValueChange={(value) => {
                const next = Array.isArray(value) ? value[0] : value;
                onDimensionsChange({ ...dimensions, [key]: next });
              }}
            />
          </div>
        ))}
        <Button
          variant="ghost"
          onClick={() => onDimensionsChange(DEFAULT_DIMENSIONS)}
        >
          Restore 240 × 270 × 270
        </Button>
      </TabsContent>
      <TabsContent value="info" className="flex flex-col gap-2 pt-4">
        <p className="text-sm">
          {dimensions.width} × {dimensions.depth} × {dimensions.height} cm open
          room rendered in 1:1 centimeter units with a 20 cm grid. Walls
          between you and the interior fade to dashed lines so the view stays
          clear.
        </p>
        <p className="text-muted-foreground text-sm">
          Floor cells are addressed A1, A2, A3 — the 10 cm grid extends beyond
          the walls with continuing labels: columns A–X run west to east,
          rows 1–27 run north to south. The west wall inherits the same rows
          and adds height levels H1–H27 from the floor up, so a wall cell is
          read as its floor row plus a height level. The east wall has an
          80 × 200 cm door opening, 100 cm from the south edge and 90 cm from
          the north.
        </p>
        <p className="text-muted-foreground text-sm">
          A table and a wardrobe start at the M22 → X27 and O1 → X6 cells. A
          loft bed fills A8 → I27 along the west wall (90 × 200 platform at
          160 cm under a 200 cm frame, with a rung ladder). A dark pegboard
          (widths 60 / 92 / 150, 37 cm deep, 180 cm tall, with shelves and
          feet) leans on the north wall in the A1 → F1 cells (widths 60 / 92 /
          150 selectable in its panel). A grey 120 × 100 carpet lies at the
          M18 → X27 cells. A black metal rack (120 × 40 × 200, five shelf
          levels) stands at M24 → X27. Click any piece to select it, drag it
          across the floor (it snaps to the 10 cm grid), and rotate it 90° at
          a time with the panel button or the R key.
        </p>
        <p className="text-muted-foreground text-sm">
          Drag to orbit the center, scroll to zoom, right-click to pan. WASD
          flies the camera around the room; arrow keys nudge the selected
          piece one grid cell at a time. Click a floor cell to select it;
          Shift+click another cell to extend the selection into a range.
        </p>
      </TabsContent>
    </Tabs>
  );
});
