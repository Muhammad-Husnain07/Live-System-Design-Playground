import { useState, useCallback, useEffect } from "react";
import { Unlock, Database, Globe, DoorOpen, Shield, Lock, Cloud, Bug, Key, UserX, Eye, EyeOff, type LucideIcon } from "lucide-react";
import { useSecurityStore, type SecurityViolation } from "../../store/securityStore";
import { useCanvasStore } from "../../store/canvasStore";
import { useToastStore } from "../../store/toastStore";
import api from "../../utils/api";
import { Box, Typography, Button } from "@mui/material";

const ZTA_TYPES = new Set(["implicit_trust", "public_secret", "llm_injection"]);

const VIOLATION_ICONS: Record<string, LucideIcon> = {
  unencrypted_transit: Unlock,
  public_database: Database,
  cross_vpc_unfirewalled: Globe,
  overly_permissive_inbound: DoorOpen,
  public_storage: Cloud,
  ssrf_vector: Bug,
  iam_privilege_escalation: Key,
  missing_authentication: UserX,
  implicit_trust: Lock,
  public_secret: Eye,
  llm_injection: Bug,
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

  const ViolationIcon = VIOLATION_ICONS[violation.type] ?? Shield;
  const isZeroTrust = ZTA_TYPES.has(violation.type);

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        border: 1,
        borderRadius: '8px',
        p: '10px',
        transition: 'all 0.15s',
        borderColor: isActive ? 'rgba(239,68,68,0.5)' : 'divider',
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
              color: 'text.primary',
            }}
          >
            {violation.type.replace(/_/g, " ")}
          </Typography>
          {isZeroTrust && (
            <Typography
              variant="caption"
              sx={{ fontSize: '7px', fontWeight: 500, px: '4px', py: '1px', borderRadius: '4px', bgcolor: 'rgba(20,184,166,0.15)',             color: 'success.main', fontFamily: 'monospace', flexShrink: 0 }}
            >
              ZTA
            </Typography>
          )}
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
            color: 'text.secondary',
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
          <Typography variant="caption" sx={{ fontSize: '9px', color: 'text.placeholder' }}>
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
  const setTrustZoneNodeIds = useSecurityStore((s) => s.setTrustZoneNodeIds);
  const trustZoneNodeIds = useSecurityStore((s) => s.trustZoneNodeIds);
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const addToast = useToastStore((s) => s.addToast);
  const [auditing, setAuditing] = useState(false);
  const [ztaScanning, setZtaScanning] = useState(false);
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

  const handleZeroTrustScan = useCallback(async () => {
    const pid = projectIdFromUrl;
    if (!pid) {
      addToast({ type: "error", title: "No project selected", message: "Open a project to run Zero Trust scan", duration: 4000 });
      return;
    }
    setZtaScanning(true);
    clearHighlights();
    try {
      const resp = await api.post("/security/audit", { projectId: pid });
      const all = (resp.data.violations ?? []) as SecurityViolation[];
      const ztaViolations = all.filter((v) => ZTA_TYPES.has(v.type));

      // Compute trust zone node IDs: nodes connected via mTLS edges (requiresTLS + authRequired)
      // or parented under a ServiceMesh node with mtlsEnabled
      const protectedNodeIds = new Set<string>();
      for (const e of edges) {
        const edgeData = e.data;
        if (edgeData?.routing?.requiresTLS && edgeData?.routing?.authRequired) {
          protectedNodeIds.add(e.source);
          protectedNodeIds.add(e.target);
        }
      }
      // Also include nodes connected to a ServiceMesh node with mtlsEnabled
      for (const n of nodes) {
        if (n.data?.nodeType === "ServiceMesh" && n.data?.config?.mtlsEnabled) {
          // All nodes connected to this mesh node via edges are in the trust zone
          for (const e of edges) {
            if (e.source === n.id) protectedNodeIds.add(e.target);
            if (e.target === n.id) protectedNodeIds.add(e.source);
          }
        }
      }

      setTrustZoneNodeIds(Array.from(protectedNodeIds));
      setViolations(all);

      if (ztaViolations.length > 0) {
        addToast({
          type: "warning",
          title: `Zero Trust: ${ztaViolations.length} violations`,
          message: "Implicit trust, public secrets, or LLM injection risks detected",
          duration: 5000,
        });
      } else {
        addToast({
          type: "success",
          title: "Zero Trust: All clear",
          message: `Architecture is Zero Trust compliant. ${protectedNodeIds.size} nodes in mTLS trust zone.`,
          duration: 4000,
        });
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Zero Trust scan failed";
      addToast({ type: "error", title: "Scan failed", message: msg, duration: 5000 });
    } finally {
      setZtaScanning(false);
    }
  }, [addToast, setViolations, setTrustZoneNodeIds, clearHighlights, projectIdFromUrl, nodes, edges]);

  const ztaViolations = violations.filter((v) => ZTA_TYPES.has(v.type));
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
          borderBottom: 1,
          borderColor: 'divider',
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
              color: 'error.main',
            }}
          >
            {violations.length}
          </Typography>
        )}
      </Box>

      <Box sx={{ px: '12px', py: '8px', borderBottom: '1px solid',         borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: '6px' }}>
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
            color: 'primary.main',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            '&:hover': { bgcolor: 'rgba(99,102,241,0.3)' },
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
                  border: '2px solid',
                  borderColor: 'rgba(99,102,241,0.3)',
                  borderTopColor: 'primary.main',
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

        <Box sx={{ display: 'flex', gap: '6px' }}>
          <Button
            onClick={handleZeroTrustScan}
            disabled={ztaScanning}
            fullWidth
            sx={{
              py: '6px',
              fontSize: '10px',
              fontWeight: 500,
              borderRadius: '4px',
              bgcolor: 'rgba(20,184,166,0.15)',
              color: '#14B8A6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              '&:hover': { bgcolor: 'rgba(20,184,166,0.25)' },
              '&.Mui-disabled': { opacity: 0.3, cursor: 'not-allowed' },
            }}
          >
            {ztaScanning ? (
              <>
                <Box
                  component="span"
                  sx={{
                    display: 'inline-block',
                    width: '10px',
                    height: '10px',
                    border: '2px solid rgba(20,184,166,0.3)',
                    borderTopColor: '#14B8A6',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }}
                />
                Scanning...
              </>
            ) : (
              <><Lock size={14} /> Zero Trust Scan</>
            )}
          </Button>

          {trustZoneNodeIds.length > 0 && (
            <Button
              onClick={() => setTrustZoneNodeIds([])}
              size="small"
              sx={{
                py: '6px',
                px: '8px',
                fontSize: '10px',
                fontWeight: 500,
                borderRadius: '4px',
                minWidth: 0,
                bgcolor: 'rgba(239,68,68,0.1)',
                color: 'error.main',
                '&:hover': { bgcolor: 'rgba(239,68,68,0.2)' },
              }}
              title="Clear trust zone highlights"
            >
              <EyeOff size={14} />
            </Button>
          )}
        </Box>
      </Box>

      {trustZoneNodeIds.length > 0 && (
        <Box sx={{ px: '12px', py: '4px', borderBottom: '1px solid',         borderColor: 'divider', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'success.main' }} />
          <Typography variant="caption" sx={{ fontSize: '8px', color: 'success.main', fontFamily: 'monospace' }}>
            Trust Zone: {trustZoneNodeIds.length} nodes secured by mTLS
          </Typography>
        </Box>
      )}

      {ztaViolations.length > 0 && (
        <Box sx={{ px: '12px', py: '6px', borderBottom: '1px solid', borderColor: '#3f3f46' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '4px', mb: '6px' }}>
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'success.main' }} />
            <Typography
              variant="caption"
              sx={{ fontSize: '9px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'success.main' }}
            >
              Zero Trust ({ztaViolations.length})
            </Typography>
          </Box>
          <Box sx={{ '& > * + *': { mt: '6px' } }}>
            {ztaViolations.map((v, i) => (
              <ViolationRow key={`zta-${i}`} violation={v} onClick={() => {}} />
            ))}
          </Box>
        </Box>
      )}

      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          '&::-webkit-scrollbar': { width: '6px' },
          '&::-webkit-scrollbar-thumb': { bgcolor: '#3f3f46', borderRadius: '3px' },
        }}
      >
        {violations.length === 0 && !auditing && !ztaScanning && (
          <Box sx={{ px: '12px', py: '32px', textAlign: 'center' }}>
            <Box sx={{ width: 48, height: 48, mx: "auto", mb: 1.5, borderRadius: "50%", bgcolor: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Shield size={20} style={{ color: "#6366F1" }} />
            </Box>
            <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.7rem", display: "block", mb: 0.5, fontWeight: 500 }}>
              Run a security audit
            </Typography>
            <Typography variant="caption" sx={{ color: "#52525b", fontSize: "0.6rem", display: "block", mb: 2, lineHeight: 1.4, px: 2 }}>
              Scan your architecture for vulnerabilities, exposed data, Zero Trust risks, and policy violations.
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
            <Typography variant="caption" sx={{ color: "text.placeholder", fontSize: "0.6rem" }}>Scanning architecture...</Typography>
          </Box>
        )}

        {critical.filter((v) => !ZTA_TYPES.has(v.type)).length > 0 && (
          <Box sx={{ px: '12px', py: '8px' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '4px', mb: '8px' }}>
              <Box sx={{ width: '6px', height: '6px', borderRadius: '50%', bgcolor: '#f87171' }} />
              <Typography
                variant="caption"
                sx={{ fontSize: '9px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#ef4444' }}
              >
                Critical ({critical.filter((v) => !ZTA_TYPES.has(v.type)).length})
              </Typography>
            </Box>
            <Box sx={{ '& > * + *': { mt: '6px' } }}>
              {critical.filter((v) => !ZTA_TYPES.has(v.type)).map((v, i) => (
                <ViolationRow key={`crit-${i}`} violation={v} onClick={() => {}} />
              ))}
            </Box>
          </Box>
        )}

        {warnings.filter((v) => !ZTA_TYPES.has(v.type)).length > 0 && (
          <Box sx={{ px: '12px', py: '8px', borderTop: 1, borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '4px', mb: '8px' }}>
              <Box sx={{ width: '6px', height: '6px', borderRadius: '50%', bgcolor: 'warning.main' }} />
              <Typography
                variant="caption"
                sx={{ fontSize: '9px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em',               color: 'warning.main' }}
              >
                Warnings ({warnings.filter((v) => !ZTA_TYPES.has(v.type)).length})
              </Typography>
            </Box>
            <Box sx={{ '& > * + *': { mt: '6px' } }}>
              {warnings.filter((v) => !ZTA_TYPES.has(v.type)).map((v, i) => (
                <ViolationRow key={`warn-${i}`} violation={v} onClick={() => {}} />
              ))}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}
