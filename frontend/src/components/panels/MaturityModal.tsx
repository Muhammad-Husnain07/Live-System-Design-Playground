import { useRef, useEffect, useState, useCallback } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography,
  LinearProgress, Chip, IconButton, Tooltip, Divider,
} from "@mui/material";
import { ShieldCheck, Download, X, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { useMaturityStore, type MaturityReport } from "../../store/maturityStore";
import { useShallow } from "zustand/react/shallow";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

function ProgressRing({ value, size = 120, strokeWidth = 10, color }: { value: number; size?: number; strokeWidth?: number; color: string }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
    </svg>
  );
}

function getScoreColor(score: number): string {
  if (score >= 91) return "#22c55e";
  if (score >= 71) return "#3b82f6";
  if (score >= 41) return "#f59e0b";
  return "#ef4444";
}

function getLevelColor(level: string): string {
  switch (level) {
    case "Enterprise Grade": return "#22c55e";
    case "Production Ready": return "#3b82f6";
    case "Staging": return "#f59e0b";
    default: return "#ef4444";
  }
}

function PriorityIcon({ priority }: { priority: string }) {
  switch (priority) {
    case "high": return <AlertTriangle size={14} color="#ef4444" />;
    case "medium": return <Info size={14} color="#f59e0b" />;
    default: return <CheckCircle size={14} color="#22c55e" />;
  }
}

interface MaturityModalProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
  simulationRunId?: string;
  projectName?: string;
  reactFlowRef?: React.RefObject<HTMLDivElement | null>;
}

export default function MaturityModal({ projectId, open, onClose, simulationRunId, projectName, reactFlowRef }: MaturityModalProps) {
  const { report, loading, error, fetchMaturity } = useMaturityStore(useShallow((s) => ({
    report: s.report,
    loading: s.loading,
    error: s.error,
    fetchMaturity: s.fetchMaturity,
  })));
  const [exporting, setExporting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      fetchMaturity(projectId, simulationRunId);
    }
  }, [open, projectId, simulationRunId, fetchMaturity]);

  const handleExportPDF = useCallback(async () => {
    if (!report) return;
    setExporting(true);
    try {
      const pdf = new jsPDF("p", "mm", "a4");
      const pageW = 190;
      let y = 20;

      const addPageIfNeeded = (needed: number) => {
        if (y + needed > 280) {
          pdf.addPage();
          y = 20;
        }
      };

      pdf.setFontSize(18);
      pdf.setTextColor(34, 197, 94);
      pdf.text("Production Readiness Report", pageW / 2, y, { align: "center" });
      y += 10;

      pdf.setFontSize(11);
      pdf.setTextColor(160, 160, 160);
      pdf.text(`Project: ${projectName || "Untitled"}`, 10, y);
      y += 6;
      pdf.text(`Date: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, 10, y);
      y += 6;
      pdf.text(`Certification Level: ${report.level}`, 10, y);
      y += 6;
      pdf.text(`Overall Score: ${report.score}/100`, 10, y);
      y += 12;

      pdf.setFontSize(14);
      pdf.setTextColor(244, 244, 245);
      pdf.text("Score Breakdown", 10, y);
      y += 8;

      const pillars = [
        { label: "Redundancy", value: report.breakdown.redundancy, max: 25, color: "#3b82f6" },
        { label: "Observability", value: report.breakdown.observability, max: 25, color: "#10b981" },
        { label: "Security", value: report.breakdown.security, max: 25, color: "#f59e0b" },
        { label: "Resilience", value: report.breakdown.resilience, max: 25, color: "#8b5cf6" },
      ];

      for (const p of pillars) {
        addPageIfNeeded(12);
        pdf.setFontSize(10);
        pdf.setTextColor(200, 200, 200);
        pdf.text(`${p.label}: ${p.value}/${p.max}`, 10, y);
        const barW = 80;
        const barH = 4;
        const pct = p.value / p.max;
        pdf.setFillColor(40, 40, 40);
        pdf.rect(100, y - 3, barW, barH, "F");
        pdf.setFillColor(
          parseInt(p.color.slice(1, 3), 16),
          parseInt(p.color.slice(3, 5), 16),
          parseInt(p.color.slice(5, 7), 16),
        );
        pdf.rect(100, y - 3, barW * pct, barH, "F");
        y += 10;
      }

      y += 4;

      if (report.recommendations.length > 0) {
        addPageIfNeeded(18);
        pdf.setFontSize(14);
        pdf.setTextColor(244, 244, 245);
        pdf.text("Recommendations", 10, y);
        y += 8;

        for (const rec of report.recommendations) {
          addPageIfNeeded(14);
          pdf.setFontSize(9);
          const priColor = rec.priority === "high" ? [239, 68, 68] as const : rec.priority === "medium" ? [245, 158, 11] as const : [34, 197, 94] as const;
          pdf.setTextColor(priColor[0], priColor[1], priColor[2]);
          pdf.text(`[${rec.priority.toUpperCase()}] ${rec.category}`, 10, y);
          y += 5;
          pdf.setTextColor(200, 200, 200);
          const lines = pdf.splitTextToSize(rec.message, pageW - 10);
          pdf.text(lines, 10, y);
          y += lines.length * 4 + 4;
        }
      }

      if (reactFlowRef?.current) {
        addPageIfNeeded(100);
        pdf.setFontSize(14);
        pdf.setTextColor(244, 244, 245);
        pdf.text("Architecture Topology", 10, y);
        y += 8;

        try {
          const canvas = await html2canvas(reactFlowRef.current, {
            backgroundColor: "#09090b",
            scale: 2,
            useCORS: true,
            logging: false,
          });
          const imgData = canvas.toDataURL("image/png");
          const imgW = pageW;
          const imgH = (canvas.height / canvas.width) * imgW;
          addPageIfNeeded(imgH + 10);
          pdf.addImage(imgData, "PNG", 10, y, imgW, Math.min(imgH, 180));
          y += Math.min(imgH, 180) + 10;
        } catch {
          pdf.setFontSize(9);
          pdf.setTextColor(239, 68, 68);
          pdf.text("Could not capture topology screenshot.", 10, y);
          y += 6;
        }
      }

      const footerY = 290;
      pdf.setFontSize(8);
      pdf.setTextColor(120, 120, 120);
      pdf.text("Generated by Live System Design Platform", pageW / 2, footerY, { align: "center" });

      pdf.save(`maturity-report-${projectName || projectId}.pdf`);
    } finally {
      setExporting(false);
    }
  }, [report, projectName, projectId, reactFlowRef]);

  const score = report?.score ?? 0;
  const level = report?.level ?? "—";
  const color = getScoreColor(score);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
      slotProps={{ paper: { sx: { bgcolor: "#18181b", border: "1px solid #3f3f46", borderRadius: "12px", backgroundImage: "none", maxHeight: "85vh" } } }}
    >
      <DialogTitle sx={{ m: 0, p: 2, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #27272a" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <ShieldCheck size={20} color="#22c55e" />
          <Typography sx={{ fontSize: "0.9rem", fontWeight: 600, color: "#f4f4f5" }}>Maturity Assessment</Typography>
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: "#71717a" }}><X size={18} /></IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 2, overflow: "auto" }} ref={printRef}>
        {loading && (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, py: 6 }}>
            <Box component="span" sx={{ "@keyframes spin": { to: { transform: "rotate(360deg)" } }, animation: "spin 1s linear infinite", height: 28, width: 28, border: "2px solid", borderColor: "#22c55e", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block" }} />
            <Typography sx={{ fontSize: "0.8rem", color: "#71717a" }}>Analyzing architecture maturity...</Typography>
          </Box>
        )}

        {error && (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5, py: 4 }}>
            <AlertTriangle size={24} color="#ef4444" />
            <Typography sx={{ fontSize: "0.8rem", color: "#ef4444", textAlign: "center" }}>{error}</Typography>
            <Button size="small" onClick={() => fetchMaturity(projectId, simulationRunId)} sx={{ fontSize: "0.75rem", color: "#60a5fa", textTransform: "none" }}>
              Retry
            </Button>
          </Box>
        )}

        {!loading && !error && report && (
          <>
            <Box sx={{ display: "flex", alignItems: "center", gap: 3, mb: 3, mt: 1 }}>
              <Box sx={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ProgressRing value={score} size={120} strokeWidth={10} color={color} />
                <Box sx={{ position: "absolute", textAlign: "center" }}>
                  <Typography sx={{ fontSize: "1.8rem", fontWeight: 700, color, fontFamily: '"ui-monospace","SFMono-Regular",monospace', lineHeight: 1 }}>
                    {score}
                  </Typography>
                  <Typography sx={{ fontSize: "0.55rem", color: "#71717a", textTransform: "uppercase", letterSpacing: "0.05em" }}>out of 100</Typography>
                </Box>
              </Box>
              <Box>
                <Typography sx={{ fontSize: "1.1rem", fontWeight: 700, color: getLevelColor(level) }}>{level}</Typography>
                <Typography sx={{ fontSize: "0.75rem", color: "#71717a", mt: 0.25 }}>
                  {score >= 91 ? "Fully hardened — suitable for mission-critical workloads" :
                   score >= 71 ? "Meets most production standards — minimal risk" :
                   score >= 41 ? "Needs hardening — some pillars pass but gaps remain" :
                   "Not ready for production — critical gaps detected"}
                </Typography>
              </Box>
            </Box>

            <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.05em", mb: 1.5 }}>Score Breakdown</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5, mb: 3 }}>
              {[
                { label: "Redundancy", value: report.breakdown.redundancy, max: 25, color: "#3b82f6" },
                { label: "Observability", value: report.breakdown.observability, max: 25, color: "#10b981" },
                { label: "Security", value: report.breakdown.security, max: 25, color: "#f59e0b" },
                { label: "Resilience", value: report.breakdown.resilience, max: 25, color: "#8b5cf6" },
              ].map((p) => (
                <Box key={p.label} sx={{ bgcolor: "#202023", borderRadius: "8px", p: 1.5, border: "1px solid #27272a" }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.75 }}>
                    <Typography sx={{ fontSize: "0.7rem", fontWeight: 500, color: "#a1a1aa" }}>{p.label}</Typography>
                    <Typography sx={{ fontSize: "0.7rem", fontWeight: 600, color: p.color, fontFamily: '"ui-monospace","SFMono-Regular",monospace' }}>
                      {p.value}/{p.max}
                    </Typography>
                  </Box>
                  <Box sx={{ position: "relative", height: 6, bgcolor: "#27272a", borderRadius: "9999px", overflow: "hidden" }}>
                    <Box sx={{ height: "100%", borderRadius: "9999px", bgcolor: p.color, width: `${(p.value / p.max) * 100}%`, transition: "width 0.6s ease" }} />
                  </Box>
                </Box>
              ))}
            </Box>

            {report.recommendations.length > 0 && (
              <>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.05em", mb: 1.5 }}>
                  Recommendations ({report.recommendations.length})
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mb: 1 }}>
                  {report.recommendations.map((rec, i) => (
                    <Box key={i} sx={{ bgcolor: "#202023", borderRadius: "8px", p: 1.5, border: "1px solid #27272a" }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                        <PriorityIcon priority={rec.priority} />
                        <Chip
                          label={rec.category}
                          size="small"
                          sx={{ height: 18, fontSize: "0.6rem", fontWeight: 500, bgcolor: "#27272a", color: "#a1a1aa", textTransform: "capitalize" }}
                        />
                        <Chip
                          label={rec.priority}
                          size="small"
                          sx={{
                            height: 18, fontSize: "0.6rem", fontWeight: 500, textTransform: "capitalize",
                            bgcolor: rec.priority === "high" ? "rgba(239,68,68,0.15)" : rec.priority === "medium" ? "rgba(245,158,11,0.15)" : "rgba(34,197,94,0.15)",
                            color: rec.priority === "high" ? "#ef4444" : rec.priority === "medium" ? "#f59e0b" : "#22c55e",
                          }}
                        />
                      </Box>
                      <Typography sx={{ fontSize: "0.75rem", color: "#d4d4d8", lineHeight: 1.5 }}>{rec.message}</Typography>
                    </Box>
                  ))}
                </Box>
              </>
            )}

            {report.recommendations.length === 0 && (
              <Box sx={{ textAlign: "center", py: 3 }}>
                <CheckCircle size={24} color="#22c55e" />
                <Typography sx={{ fontSize: "0.85rem", color: "#22c55e", mt: 1, fontWeight: 500 }}>No recommendations — architecture is well-optimized!</Typography>
              </Box>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: "1px solid #27272a", gap: 1 }}>
        <Button onClick={onClose} sx={{ fontSize: "0.75rem", color: "#a1a1aa", textTransform: "none", "&:hover": { bgcolor: "#27272a" } }}>
          Close
        </Button>
        {report && (
          <Button
            onClick={handleExportPDF}
            disabled={exporting}
            startIcon={exporting ? (
              <Box component="span" sx={{ "@keyframes spin": { to: { transform: "rotate(360deg)" } }, animation: "spin 1s linear infinite", height: 14, width: 14, border: "1.5px solid", borderColor: "#22c55e", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block" }} />
            ) : <Download size={14} />}
            sx={{ fontSize: "0.75rem", color: "#22c55e", textTransform: "none", bgcolor: "rgba(34,197,94,0.1)", "&:hover": { bgcolor: "rgba(34,197,94,0.2)" } }}
          >
            {exporting ? "Exporting..." : "Export Report (PDF)"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
