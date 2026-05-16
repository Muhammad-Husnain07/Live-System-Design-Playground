import { memo } from "react";
import { type NodeProps } from "reactflow";
import BaseNode from "./BaseNode";
import type { BaseNodeData } from "./BaseNode";

function DatabaseNode(props: NodeProps<BaseNodeData>) {
  return (
    <BaseNode {...props}>
      <div className="h-4 relative overflow-hidden rounded-sm">
        <div className="absolute inset-x-0 top-0 h-3 rounded-t-full border border-surface-600/60 mx-1" />
        <div className="absolute inset-x-1 top-2 bottom-0 bg-gradient-to-b from-surface-700/40 to-transparent rounded-b" />
      </div>
    </BaseNode>
  );
}

export default memo(DatabaseNode);
