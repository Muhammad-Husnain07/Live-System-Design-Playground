import { useState, useCallback, useEffect } from "react";
import { Unlock, Database, Globe, DoorOpen, Shield, Lock, type LucideIcon } from "lucide-react";
import { useSecurityStore, type SecurityViolation } from "../../store/securityStore";
import { useCanvasStore } from "../../store/canvasStore";
import { useToastStore } from "../../store/toastStore";
import api from "../../utils/api";

const VIOLATION_ICONS: Record<string, LucideIcon> = {
  unencrypted_transit: Unlock,
  public_database: Database,
  cross_vpc_unfirewalled: Globe,
  overly_permissive_inbound: DoorOpen,
};

function ViolationRow({
  violation,
  onClick,
}: {
  violation: SecurityViolation;
  onClick: () => void;
}) {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const edgesList = edges.map((e) => ({ id: e.id, source: e.source, target: e.target }));
  const highlightViolation = useSecurityStore((s) => s.highlightViolation);
  const highlightedNodeIds = useSecurityStore((s) => s.highlightedNodeIds);
  const sourceLabel = nodes.find((n) => n.id === violation.sourceNodeId)?.data?.label ?? violation.sourceNodeId;
  const targetLabel = nodes.find((n) => n.id === violation.targetNodeId)?.data?.label ?? violation.targetNodeId;
  const isActive =
    highlightedNodeIds.includes(violation.sourceNodeId) || highlightedNodeIds.includes(violation.targetNodeId);

  const ViolationIcon = VIOLATION_ICONS[violation.type] ?? Lock;

  return (
    <button
      onClick={() => {
        highlightViolation(violation, edgesList);
        onClick();
      }}
      className={`w-full text-left bg-surface-900 border rounded-lg p-2.5 transition-all hover:bg-surface-800 ${
        isActive ? "border-red-500/50 ring-1 ring-red-500/20" : "border-surface-800"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <ViolationIcon className="h-4 w-4" />
        <span className="text-[10px] font-medium text-surface-200 truncate flex-1">
          {violation.type.replace(/_/g, " ")}
        </span>
      </div>
      <p className="text-[9px] text-surface-400 leading-relaxed line-clamp-2">{violation.message}</p>
      <div className="flex items-center gap-1.5 mt-1.5 text-[9px]">
        <span className="text-surface-500 truncate max-w-[80px]">{sourceLabel}</span>
        <span className="text-surface-600">&rarr;</span>
        <span className="text-surface-500 truncate max-w-[80px]">{targetLabel}</span>
      </div>
    </button>
  );
}

export default function SecurityPanel() {
  const violations = useSecurityStore((s) => s.violations);
  const setViolations = useSecurityStore((s) => s.setViolations);
  const clearHighlights = useSecurityStore((s) => s.clearHighlights);
  const addToast = useToastStore((s) => s.addToast);
  const [auditing, setAuditing] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);

  const projectIdFromUrl = typeof window !== "undefined" ? window.location.pathname.match(/\/project\/([^/]+)/)?.[1] ?? null : null;
  useEffect(() => {
    if (!projectId && projectIdFromUrl) setProjectId(projectIdFromUrl);
  }, [projectId, projectIdFromUrl]);

  const handleAudit = useCallback(async () => {
    const pid = projectIdFromUrl;
    if (!pid) {
      addToast({ type: "error", title: "No project selected", message: "Open a project to run security audit", duration: 4000 });
      return;
    }
    setAuditing(true);
    clearHighlights();
    try {
      const resp = await api.post("/security/audit", { projectId: pid });
      setViolations(resp.data.violations ?? []);
      addToast({
        type: resp.data.violations?.length > 0 ? "warning" : "success",
        title: resp.data.violations?.length > 0 ? `Found ${resp.data.violations.length} violations` : "All clear",
        message: resp.data.violations?.length > 0 ? "Review and fix the issues below" : "No security issues detected",
        duration: 4000,
      });
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Audit request failed";
      addToast({ type: "error", title: "Audit failed", message: msg, duration: 5000 });
    } finally {
      setAuditing(false);
    }
  }, [addToast, setViolations, clearHighlights, projectIdFromUrl]);

  const critical = violations.filter((v) => v.severity === "critical");
  const warnings = violations.filter((v) => v.severity === "warning");

  return (
    <div className="w-80 shrink-0 bg-surface-950 border-l border-surface-800 flex flex-col overflow-hidden">
      <div className="px-3 py-2.5 border-b border-surface-800 flex items-center gap-2">
        <Shield className="h-4 w-4" />
        <span className="text-xs font-semibold text-surface-100">Security Audit</span>
        {violations.length > 0 && (
          <span className="ml-auto text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full font-mono">
            {violations.length}
          </span>
        )}
      </div>

      <div className="px-3 py-2 border-b border-surface-800">
        <button
          onClick={handleAudit}
          disabled={auditing}
          className="w-full py-2 text-[11px] font-medium rounded transition-colors bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
        >
          {auditing ? (
            <>
              <span className="inline-block w-3 h-3 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
              Scanning...
            </>
          ) : (
            <><Shield className="h-4 w-4" /> Run Security Audit</>
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-surface-800">
        {violations.length === 0 && (
          <div className="px-3 py-8 text-center">
            <p className="text-[10px] text-surface-600">No audit results yet</p>
            <p className="text-[9px] text-surface-700 mt-1">Click the button above to scan for violations</p>
          </div>
        )}

        {critical.length > 0 && (
          <div className="px-3 py-2">
            <p className="text-[9px] uppercase tracking-wider text-red-400 font-medium mb-2 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              Critical ({critical.length})
            </p>
            <div className="space-y-1.5">
              {critical.map((v, i) => (
                <ViolationRow key={`crit-${i}`} violation={v} onClick={() => {}} />
              ))}
            </div>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="px-3 py-2 border-t border-surface-800">
            <p className="text-[9px] uppercase tracking-wider text-orange-400 font-medium mb-2 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
              Warnings ({warnings.length})
            </p>
            <div className="space-y-1.5">
              {warnings.map((v, i) => (
                <ViolationRow key={`warn-${i}`} violation={v} onClick={() => {}} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
