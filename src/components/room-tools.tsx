"use client";

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

export function RoomTools({
  dimensions,
  onDimensionsChange,
  autoRotate,
  onAutoRotateChange,
  onResetView,
}: {
  dimensions: RoomDimensions;
  onDimensionsChange: (dimensions: RoomDimensions) => void;
  autoRotate: boolean;
  onAutoRotateChange: (autoRotate: boolean) => void;
  onResetView: () => void;
}) {
  const sliders = [
    { key: "width", label: "Width" },
    { key: "depth", label: "Depth" },
    { key: "height", label: "Height" },
  ] as const;

  return (
    <Tabs
      defaultValue="view"
      className="bg-background/80 rounded-2xl border p-4 shadow-none backdrop-blur-md"
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
          Floor cells are addressed A1, A2, A3 — columns A to L run west to
          east, rows 1 to 14 run north to south. The compass points north.
          The east wall has an 80 × 200 cm door opening, 100 cm from the south
          edge and 90 cm from the north.
        </p>
        <p className="text-muted-foreground text-sm">
          Drag to orbit the center, scroll to zoom, right-click to pan.
        </p>
      </TabsContent>
    </Tabs>
  );
}
