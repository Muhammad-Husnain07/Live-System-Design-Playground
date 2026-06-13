import { useState } from "react";
import { Separator } from "react-resizable-panels";

export default function ResizeHandle({ direction = "horizontal" }: { direction?: "horizontal" | "vertical" }) {
  const [hovered, setHovered] = useState(false);
  const isHorizontal = direction === "horizontal";
  return (
    <Separator
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: isHorizontal ? "col-resize" : "row-resize",
        transition: "background-color 0.15s ease",
        [isHorizontal ? "minWidth" : "minHeight"]: 4,
        [isHorizontal ? "minHeight" : "minWidth"]: 0,
        width: isHorizontal ? 4 : "100%",
        height: isHorizontal ? "100%" : 4,
      }}
    >
      <div
        style={{
          [isHorizontal ? "width" : "height"]: 2,
          [isHorizontal ? "height" : "width"]: "100%",
          borderRadius: 1,
          backgroundColor: hovered ? "#6366F1" : "#2A2A2E",
          transition: "background-color 0.15s ease",
          pointerEvents: "none",
        }}
      />
    </Separator>
  );
}
