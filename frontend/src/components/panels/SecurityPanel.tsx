import { useState, useCallback, useEffect } from "react";
import { Unlock, Database, Globe, DoorOpen, Shield, Lock, Cloud, Bug, Key, UserX, type LucideIcon } from "lucide-react";
import { useSecurityStore, type SecurityViolation } from "../../store/securityStore";
import { useCanvasStore } from "../../store/canvasStore";
import { useToastStore } from "../../store/toastStore";
import api from "../../utils/api";
import { Box, Typography, Button } from "@mui/material";

const VIOLATION_ICONS: Record<string, LucideIcon> = {
  unencrypted_transit: Unlock,
  public_database: Database,
  cross_vpc_unfirewalled: Globe,
  overly_permissive_inbound: DoorOpen,
  public_storage: Cloud,
  ssrf_vector: Bug,
  iam_privilege_escalation: Key,
  missing_authentication: UserX,
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
  const [showRemediation, setShowRemediation] = useState(false);
  const edgesList = edges.map((e) => ({ id: e.id, source: e.source, target: e.target }));
  const highlightViolation = useSecurityStore((s) => s.highlightViolation);
  const highlightedNodeIds = useSecurityStore((s) => s.highlightedNodeIds);
  const sourceLabel = nodes.find((n) => n.id === violation.sourceNodeId)?.data?.label ?? violation.sourceNodeId;
  const targetLabel = nodes.find((n) => n.id === violation.targetNodeId)?.data?.label ?? violation.targetNodeId;
  const isActive =
    highlightedNodeIds.includes(violation.sourceNodeId) || highlightedNodeIds.includes(violation.targetNodeId);

  const ViolationIcon = VIOLATION_ICONS[violation.type] ?? Lock;

  return (
    <Box
      sx={{
        bgcolor: '#18181b',
        border: '1px solid',
        borderRadius: '8px',
        p: '10px',
        transition: 'all 0.15s',
        borderColor: isActive ? 'rgba(239,68,68,0.5)' : '#3f3f46',
        boxShadow: isActive ? '0 0 0 1px rgba(239,68,68,0.2)' : 'none',
      }}
    >
      <Button
        onClick={() => {
          highlightViolation(violation, edgesList);
          onClick();
        }}
        fullWidth
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'flex-start',
          textTransform: 'none',
          p: 0,
          minWidth: 0,
          minHeight: 0,
          bgcolor: 'transparent',
          color: 'inherit',
          lineHeight: 'normal',
          textAlign: 'left',
          borderRadius: 0,
          '&:hover': { bgcolor: 'transparent' },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', mb: '4px' }}>
          <Box component="span" sx={{ display: 'flex' }}>
            <ViolationIcon size={16} />
          </Box>
          <Typography
            variant="caption"
            sx={{
              fontSize: '10px',
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              color: '#f4f4f5',
            }}
          >
            {violation.type.replace(/_/g, " ")}
          </Typography>
        </Box>
        <Typography
          variant="caption"
          sx={{
            fontSize: '9px',
            lineHeight: 1.5,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            color: '#a1a1aa',
            textAlign: 'left',
            width: '100%',
          }}
        >
          {violation.message}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px', mt: '6px' }}>
          <Typography
            variant="caption"
            sx={{ fontSize: '9px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80px', color: '#a1a1aa' }}
          >
            {sourceLabel}
          </Typography>
          <Typography variant="caption" sx={{ fontSize: '9px', color: '#52525b' }}>
            &rarr;
          </Typography>
          <Typography
            variant="caption"
            sx={{ fontSize: '9px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80px', color: '#a1a1aa' }}
          >
            {targetLabel}
          </Typography>
        </Box>
      </Button>
      {violation.remediation && (
        <Button
          onClick={() => setShowRemediation((v) => !v)}
          fullWidth
          sx={{
            mt: '8px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'flex-start',
            textTransform: 'none',
            fontSize: '8px',
            px: '8px',
            py: '4px',
            borderRadius: '4px',
            bgcolor: 'rgba(23,37,84,0.3)',
            border: '1px solid rgba(30,64,175,0.3)',
            color: '#60a5fa',
            minHeight: 0,
            lineHeight: 1.2,
            textAlign: 'left',
            '&:hover': { bgcolor: 'rgba(30,58,138,0.3)' },
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: 500, color: '#60a5fa', fontSize: '8px' }}>
            {showRemediation ? "Hide" : "Show"} remediation
          </Typography>
          {showRemediation && (
            <Typography
              variant="caption"
              sx={{ mt: '4px', lineHeight: 1.5, color: 'rgba(147, 197, 253, 0.8)', fontSize: '8px', display: 'block', textAlign: 'left' }}
            >
              {violation.remediation}
            </Typography>
          )}
        </Button>
      )}
    </Box>
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
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        height: '100%',
      }}
    >
      <Box
        sx={{
          px: '12px',
          py: '10px',
          borderBottom: '1px solid',
          borderColor: '#3f3f46',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <Shield size={16} />
        <Typography variant="caption" sx={{ fontSize: '12px', fontWeight: 600, color: '#f4f4f5' }}>
          Security Audit
        </Typography>
        {violations.length > 0 && (
          <Typography
            variant="caption"
            sx={{
              ml: 'auto',
              fontSize: '9px',
              bgcolor: 'rgba(239,68,68,0.2)',
              px: '6px',
              py: '2px',
              borderRadius: '9999px',
              fontFamily: 'monospace',
              color: '#ef4444',
            }}
          >
            {violations.length}
          </Typography>
        )}
      </Box>

      <Box sx={{ px: '12px', py: '8px', borderBottom: '1px solid', borderColor: '#3f3f46' }}>
        <Button
          onClick={handleAudit}
          disabled={auditing}
          fullWidth
          sx={{
            py: '8px',
            fontSize: '11px',
            fontWeight: 500,
            borderRadius: '4px',
            bgcolor: 'rgba(59,130,246,0.2)',
            color: '#60a5fa',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            '&:hover': { bgcolor: 'rgba(59,130,246,0.3)' },
            '&.Mui-disabled': { opacity: 0.3, cursor: 'not-allowed' },
          }}
        >
          {auditing ? (
            <>
              <Box
                component="span"
                sx={{
                  display: 'inline-block',
                  width: '12px',
                  height: '12px',
                  border: '2px solid rgba(96,165,250,0.3)',
                  borderTopColor: '#60a5fa',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  '@keyframes spin': {
                    '0%': { transform: 'rotate(0deg)' },
                    '100%': { transform: 'rotate(360deg)' },
                  },
                }}
              />
              Scanning...
            </>
          ) : (
            <><Shield size={16} /> Run Security Audit</>
          )}
        </Button>
      </Box>

      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          '&::-webkit-scrollbar': { width: '6px' },
          '&::-webkit-scrollbar-thumb': { bgcolor: '#3f3f46', borderRadius: '3px' },
        }}
      >
        {violations.length === 0 && !auditing && (
          <Box sx={{ px: '12px', py: '32px', textAlign: 'center' }}>
            <Box sx={{ width: 48, height: 48, mx: "auto", mb: 1.5, borderRadius: "50%", bgcolor: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Shield size={20} style={{ color: "#60a5fa" }} />
            </Box>
            <Typography variant="caption" sx={{ color: "#a1a1aa", fontSize: "0.7rem", display: "block", mb: 0.5, fontWeight: 500 }}>
              Run a security audit
            </Typography>
            <Typography variant="caption" sx={{ color: "#52525b", fontSize: "0.6rem", display: "block", mb: 2, lineHeight: 1.4, px: 2 }}>
              Scan your architecture for vulnerabilities, exposed data, and policy violations.
            </Typography>
            <Button
              onClick={handleAudit}
              variant="contained"
              sx={{
                fontSize: "0.7rem", fontWeight: 500, px: 2, py: 0.75,
                bgcolor: "rgba(59,130,246,0.2)", color: "#60a5fa",
                "&:hover": { bgcolor: "rgba(59,130,246,0.3)" },
              }}
            >
              {auditing ? "Scanning..." : "Run Security Audit"}
            </Button>
          </Box>
        )}
        {auditing && violations.length === 0 && (
          <Box sx={{ px: '12px', py: '32px', textAlign: 'center' }}>
            <Typography variant="caption" sx={{ color: "#52525b", fontSize: "0.6rem" }}>Scanning architecture...</Typography>
          </Box>
        )}

        {critical.length > 0 && (
          <Box sx={{ px: '12px', py: '8px' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '4px', mb: '8px' }}>
              <Box sx={{ width: '6px', height: '6px', borderRadius: '50%', bgcolor: '#f87171' }} />
              <Typography
                variant="caption"
                sx={{ fontSize: '9px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#ef4444' }}
              >
                Critical ({critical.length})
              </Typography>
            </Box>
            <Box sx={{ '& > * + *': { mt: '6px' } }}>
              {critical.map((v, i) => (
                <ViolationRow key={`crit-${i}`} violation={v} onClick={() => {}} />
              ))}
            </Box>
          </Box>
        )}

        {warnings.length > 0 && (
          <Box sx={{ px: '12px', py: '8px', borderTop: '1px solid', borderColor: '#3f3f46' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '4px', mb: '8px' }}>
              <Box sx={{ width: '6px', height: '6px', borderRadius: '50%', bgcolor: '#fb923c' }} />
              <Typography
                variant="caption"
                sx={{ fontSize: '9px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#fb923c' }}
              >
                Warnings ({warnings.length})
              </Typography>
            </Box>
            <Box sx={{ '& > * + *': { mt: '6px' } }}>
              {warnings.map((v, i) => (
                <ViolationRow key={`warn-${i}`} violation={v} onClick={() => {}} />
              ))}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}
