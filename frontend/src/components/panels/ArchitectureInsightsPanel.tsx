import { useEffect, useMemo } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography,
  Card, CardContent, Chip, IconButton, LinearProgress,
} from "@mui/material";
import { Lightbulb, X, CheckCircle, Circle } from "lucide-react";
import { useCanvasStore } from "../../store/canvasStore";
import { useArchitectureStore } from "../../store/architectureStore";

interface ArchitectureInsightsPanelProps {
  open: boolean;
  onClose: () => void;
}

function InsightRow({ label, met, detail }: { label: string; met: boolean; detail: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, py: 0.75 }}>
      {met ? (
        <CheckCircle size={16} style={{ color: "#22c55e", flexShrink: 0, marginTop: 2 }} />
      ) : (
        <Circle size={16} style={{ color: "#52525b", flexShrink: 0, marginTop: 2 }} />
      )}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: "0.75rem", fontWeight: 500, color: met ? "#d4d4d8" : "#71717a" }}>
          {label}
        </Typography>
        <Typography sx={{ fontSize: "0.65rem", color: "#52525b", mt: 0.25, lineHeight: 1.4 }}>
          {detail}
        </Typography>
      </Box>
    </Box>
  );
}

export default function ArchitectureInsightsPanel({ open, onClose }: ArchitectureInsightsPanelProps) {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const computeBadges = useArchitectureStore((s) => s.computeBadges);
  const scorecards = useArchitectureStore((s) => s.scorecards);

  useEffect(() => {
    if (open) {
      computeBadges(nodes, edges);
    }
  }, [open, nodes, edges, computeBadges]);

  const totalItems = useMemo(() => scorecards.reduce((sum, s) => sum + s.items.length, 0), [scorecards]);
  const metItems = useMemo(() => scorecards.reduce((sum, s) => sum + s.items.filter((i) => i.met).length, 0), [scorecards]);
  const overallPct = totalItems > 0 ? Math.round((metItems / totalItems) * 100) : 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: "#18181b", border: "1px solid #3f3f46", borderRadius: "12px",
            backgroundImage: "none", maxHeight: "85vh",
          },
        },
      }}
    >
      <DialogTitle sx={{ m: 0, p: 2, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #27272a" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Lightbulb size={20} color="#eab308" />
          <Typography sx={{ fontSize: "0.9rem", fontWeight: 600, color: "#f4f4f5" }}>
            Architecture Insights
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: "#71717a" }}>
          <X size={18} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 2, overflow: "auto" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2.5, mt: 1 }}>
          <Box sx={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Box
              sx={{
                width: 72, height: 72, borderRadius: "50%",
                background: `conic-gradient(#22c55e ${overallPct}%, #27272a ${overallPct}%)`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <Box sx={{ width: 56, height: 56, borderRadius: "50%", bgcolor: "#18181b", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Typography sx={{ fontSize: "1.1rem", fontWeight: 700, color: "#f4f4f5", fontFamily: '"ui-monospace","SFMono-Regular",monospace' }}>
                  {overallPct}%
                </Typography>
              </Box>
            </Box>
          </Box>
          <Box>
            <Typography sx={{ fontSize: "0.85rem", fontWeight: 600, color: "#f4f4f5" }}>
              Modern Architecture Score
            </Typography>
            <Typography sx={{ fontSize: "0.7rem", color: "#71717a", mt: 0.25 }}>
              {metItems} of {totalItems} best practices adopted
            </Typography>
          </Box>
        </Box>

        {scorecards.map((sc) => {
          const met = sc.items.filter((i) => i.met).length;
          const total = sc.items.length;
          const pct = total > 0 ? Math.round((met / total) * 100) : 0;
          return (
            <Card
              key={sc.title}
              sx={{
                bgcolor: "#202023", border: "1px solid #27272a", borderRadius: "8px", mb: 1.5,
                "&:last-child": { mb: 0 },
              }}
            >
              <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                  <Typography component="span" sx={{ fontSize: "1.1rem", lineHeight: 1 }}>
                    {sc.icon}
                  </Typography>
                  <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: "#f4f4f5", flex: 1 }}>
                    {sc.title}
                  </Typography>
                  <Chip
                    label={`${met}/${total}`}
                    size="small"
                    sx={{
                      height: 20, fontSize: "0.6rem", fontWeight: 600,
                      bgcolor: pct >= 80 ? "rgba(34,197,94,0.15)" : pct >= 40 ? "rgba(245,158,11,0.15)" : "rgba(239,68,68,0.15)",
                      color: pct >= 80 ? "#22c55e" : pct >= 40 ? "#f59e0b" : "#ef4444",
                      border: 1,
                      borderColor: pct >= 80 ? "rgba(34,197,94,0.2)" : pct >= 40 ? "rgba(245,158,11,0.2)" : "rgba(239,68,68,0.2)",
                    }}
                  />
                </Box>
                <Box sx={{ mb: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={pct}
                    sx={{
                      height: 4, borderRadius: "999px", bgcolor: "#27272a",
                      "& .MuiLinearProgress-bar": { bgcolor: sc.color, borderRadius: "999px" },
                    }}
                  />
                </Box>
                {sc.items.map((item) => (
                  <InsightRow key={item.label} label={item.label} met={item.met} detail={item.detail} />
                ))}
              </CardContent>
            </Card>
          );
        })}
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: "1px solid #27272a" }}>
        <Button
          onClick={onClose}
          sx={{ fontSize: "0.75rem", color: "#a1a1aa", textTransform: "none", "&:hover": { bgcolor: "#27272a" } }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
