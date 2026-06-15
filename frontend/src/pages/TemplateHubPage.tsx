import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { useAuthStore } from "../store/authStore";
import { useProjectStore } from "../store/projectStore";
import { useToastStore } from "../store/toastStore";
import { ENTERPRISE_TEMPLATES, type EnterpriseTemplate } from "../utils/enterpriseTemplates";
import { Globe, Radio, DoorOpen, Server, Puzzle, Database, Inbox, Wrench, Smartphone, Scale, Link, Container, Plug, type LucideIcon } from "lucide-react";
import {
  Box, Typography, Grid, Card, CardContent,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Chip, Avatar, Menu, MenuItem
} from "@mui/material";

const INDUSTRY_COLORS: Record<string, string> = {
  Media: "#A855F7",
  RideShare: "#06B6D4",
  "E-Commerce": "#F97316",
  Finance: "#22C55E",
};

const TYPE_ICONS: Record<string, LucideIcon> = {
  DNS: Globe, CDN: Radio, APIGateway: DoorOpen, AppServer: Server,
  Microservice: Puzzle, PostgreSQLDB: Database, MongoDB: Database, EventBus: Inbox,
  WorkerService: Wrench, MobileClient: Smartphone, LoadBalancer: Scale, Redis: Database,
  WebBrowser: Globe, ThirdPartyAPI: Link, MessageQueue: Inbox,
  ContainerCluster: Container, ExternalClient: Plug,
};

const PROTOCOL_COLORS: Record<string, string> = {
  HTTP: "#3B82F6", WebSocket: "#EC4899", gRPC: "#A855F7",
  TCP: "#F97316", AMQP: "#F59E0B", Replication: "#EF4444",
};

function IndustryChip({ label }: { label: string }) {
  return (
    <Chip
      label={label}
      size="small"
      sx={{ color: INDUSTRY_COLORS[label] || "#94a3b8", borderColor: `${INDUSTRY_COLORS[label] || "#94a3b8"}40`, fontWeight: 500, bgcolor: `${INDUSTRY_COLORS[label] || "#94a3b8"}15` }}
      variant="outlined"
    />
  );
}

function ScaleBadge({ label }: { label: string }) {
  return (
    <Chip
      label={label}
      size="small"
      sx={{ color: "#22C55E", borderColor: "#22C55E40", fontWeight: 600, bgcolor: "#22C55E15" }}
      variant="outlined"
    />
  );
}

export default function TemplateHubPage() {
  const { user, logout } = useAuthStore(useShallow((s) => ({ user: s.user, logout: s.logout })));
  const navigate = useNavigate();
  const { createProject } = useProjectStore(useShallow((s) => ({ createProject: s.createProject })));
  const addToast = useToastStore((s) => s.addToast);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [selected, setSelected] = useState<EnterpriseTemplate | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleUseTemplate = useCallback(async (tpl: EnterpriseTemplate) => {
    setLoadingId(tpl.id);
    try {
      const { nodes, edges } = tpl.build(0, 0);
      const project = await createProject(tpl.label, `Seeded from ${tpl.label} template`, false);
      const canvasData = { nodes, edges, viewport: { x: 0, y: 0, zoom: 1 } };
      await useProjectStore.getState().saveCanvas(project.id, canvasData);
      setSelected(null);
      addToast({ type: "success", title: `"${tpl.label}" created`, message: "Project seeded with template architecture", duration: 3000 });
      navigate(`/project/${project.id}`);
    } catch (err: any) {
      const msg = err?.message || "Failed to create project from template";
      addToast({ type: "error", title: "Template failed", message: msg, duration: 4000 });
    } finally {
      setLoadingId(null);
    }
  }, [createProject, navigate, addToast]);

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Box
        component="header"
        sx={{
          borderBottom: 1, borderColor: "divider", px: 3, py: 1.5,
          display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Typography
            onClick={() => navigate("/dashboard")}
            variant="h6"
            sx={{ fontWeight: 700, letterSpacing: "-0.02em", color: "primary.main", cursor: "pointer", userSelect: "none" }}
          >
            LSDP
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.25 }}>/</Typography>
          <Typography variant="body2" sx={{ color: "text.primary", fontWeight: 500 }}>Templates</Typography>
        </Box>
        <Box>
          <Button
            onClick={(e) => setAnchorEl(e.currentTarget)}
            sx={{ color: "text.secondary", textTransform: "none", display: "flex", alignItems: "center", gap: 1 }}
          >
            <Avatar sx={{ width: 28, height: 28, fontSize: "0.75rem", fontWeight: 500, bgcolor: "action.hover", color: "text.secondary" }}>
              {user?.username?.charAt(0).toUpperCase() || "U"}
            </Avatar>
            <Typography variant="body2" color="text.secondary" sx={{ display: { xs: "none", sm: "inline" } }}>
              {user?.username}
            </Typography>
          </Button>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
          >
            <MenuItem onClick={() => { setAnchorEl(null); navigate("/settings"); }}>
              Profile
            </MenuItem>
            <MenuItem onClick={() => { setAnchorEl(null); logout(); }} sx={{ "&:hover": { color: "error.main" } }}>
              Logout
            </MenuItem>
          </Menu>
        </Box>
      </Box>

      <Box component="main" sx={{ flex: 1, px: 3, py: 3, maxWidth: 1024, mx: "auto", width: "100%" }}>
        <Typography variant="h5" sx={{ fontWeight: 600, color: "text.primary", mb: 0.5 }}>
          Architecture Templates
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
          Pre-built enterprise architectures with full configuration. Click to preview and deploy.
        </Typography>

        <Grid container spacing={3} columns={12}>
          {ENTERPRISE_TEMPLATES.map((tpl) => (
            <Grid key={tpl.id} size={{ xs: 12, sm: 6 }}>
              <Card
                onClick={() => setSelected(tpl)}
                sx={{
                  bgcolor: "background.paper", border: 1, borderColor: "divider", cursor: "pointer",
                  transition: "all 0.15s ease",
                  "&:hover": { borderColor: "primary.main", boxShadow: "0 0 0 1px rgba(59,130,246,0.3)" },
                }}
              >
                <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
                  <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 1.5 }}>
                    <Typography variant="h6" sx={{ fontSize: "1rem", fontWeight: 600, color: "text.primary", display: "flex", alignItems: "center", gap: 0.75 }}>
                      {(() => { const Icon = tpl.icon; return <Icon size={18} />; })()} {tpl.label}
                    </Typography>
                    <ScaleBadge label={tpl.scale} />
                  </Box>
                  <Typography variant="body2" sx={{ color: "text.secondary", mb: 1.5, lineHeight: 1.4, minHeight: 36 }}>
                    {tpl.desc}
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                    <IndustryChip label={tpl.industry} />
                    <Chip label={`${tpl.totalInstances} instances`} size="small" variant="outlined" sx={{ color: "text.secondary", borderColor: "divider" }} />
                    <Chip label={`${tpl.nodePreview.length} nodes`} size="small" variant="outlined" sx={{ color: "text.secondary", borderColor: "divider" }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      <Dialog
        open={Boolean(selected)}
        onClose={() => { if (!loadingId) setSelected(null); }}
        maxWidth="md"
        fullWidth
        slotProps={{ paper: { sx: { bgcolor: "background.paper", maxHeight: "85vh" } } }}
      >
        {selected && (
          <>
            <DialogTitle sx={{ borderBottom: 1, borderColor: "divider", pb: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 1 }}>
                  {(() => { const Icon = selected.icon; return <Icon size={20} />; })()} {selected.label}
                </Typography>
                <ScaleBadge label={selected.scale} />
              </Box>
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 1 }}>
                <IndustryChip label={selected.industry} />
                <Chip label={`${selected.totalInstances} instances`} size="small" variant="outlined" sx={{ color: "text.secondary", borderColor: "divider" }} />
                <Chip label={`${selected.peakRPS.toLocaleString()} peak RPS`} size="small" variant="outlined" sx={{ color: "text.secondary", borderColor: "divider" }} />
              </Box>
            </DialogTitle>
            <DialogContent sx={{ py: 2 }}>
              <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
                {selected.desc}
              </Typography>

              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.primary", mb: 1 }}>
                Components ({selected.nodePreview.length} nodes, {selected.edgePreview.length} connections)
              </Typography>

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                    {selected.nodePreview.map((np, i) => (
                      <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1, px: 1, py: 0.5, borderRadius: 1, "&:hover": { bgcolor: "action.hover" } }}>
                        <Typography variant="body2" sx={{ display: "inline-flex", alignItems: "center" }}>{(() => { const Icon = TYPE_ICONS[np.type]; return Icon ? <Icon size={14} /> : null; })()}</Typography>
                        <Typography variant="body2" sx={{ color: "text.primary", fontWeight: 500 }}>{np.label}</Typography>
                        <Typography variant="caption" sx={{ color: "text.disabled", ml: "auto" }}>{np.type}</Typography>
                      </Box>
                    ))}
                  </Box>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                    {selected.edgePreview.map((ep, i) => (
                      <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1, px: 1, py: 0.5, borderRadius: 1, "&:hover": { bgcolor: "action.hover" } }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, bgcolor: PROTOCOL_COLORS[ep.protocol] || "#94a3b8" }} />
                        <Typography variant="caption" sx={{ color: "text.secondary", fontFamily: "monospace", fontSize: "0.7rem" }}>
                          {ep.from}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "text.disabled" }}>→</Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary", fontFamily: "monospace", fontSize: "0.7rem" }}>
                          {ep.to}
                        </Typography>
                        <Chip label={ep.protocol} size="small" variant="outlined" sx={{ height: 18, fontSize: "0.6rem", ml: "auto", color: PROTOCOL_COLORS[ep.protocol] || "#94a3b8", borderColor: `${PROTOCOL_COLORS[ep.protocol] || "#94a3b8"}40` }} />
                      </Box>
                    ))}
                  </Box>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions sx={{ borderTop: 1, borderColor: "divider", px: 3, py: 2 }}>
              <Button onClick={() => setSelected(null)} disabled={Boolean(loadingId)} sx={{ color: "text.secondary" }}>
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={() => handleUseTemplate(selected)}
                disabled={loadingId === selected.id}
                sx={{ minWidth: 140 }}
              >
                {loadingId === selected.id ? "Creating..." : "Use Template"}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}

