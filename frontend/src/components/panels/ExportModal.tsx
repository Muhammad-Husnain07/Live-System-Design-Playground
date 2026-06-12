import { useState } from "react";
import Editor from "@monaco-editor/react";
import { useExportStore } from "../../store/exportStore";
import { exportTerraform, exportKubernetes, exportCloudFormation, exportTerraformGCP, exportTerraformAzure, exportDeploymentManager, exportArm } from "../../utils/iacExporter";
import { Dialog, DialogTitle, DialogContent, DialogActions, Tabs, Tab, Box, Button, Typography } from "@mui/material";

interface IaCTab {
  id: string;
  label: string;
  generator: () => string;
}

import { useShallow } from "zustand/react/shallow";

export default function ExportModal() {
  const { showModal, closeExport } = useExportStore(useShallow((s) => ({ showModal: s.showModal, closeExport: s.closeExport })));
  const [tabIndex, setTabIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [iacError, setIacError] = useState<string | null>(null);

  const tabs: IaCTab[] = [
    { id: "terraform", label: "Terraform", generator: exportTerraform },
    { id: "terraform-gcp", label: "Terraform (GCP)", generator: exportTerraformGCP },
    { id: "terraform-azure", label: "Terraform (Azure)", generator: exportTerraformAzure },
    { id: "kubernetes", label: "Kubernetes", generator: exportKubernetes },
    { id: "cloudformation", label: "CloudFormation", generator: exportCloudFormation },
    { id: "deployment-manager", label: "Deployment Manager", generator: exportDeploymentManager },
    { id: "arm", label: "ARM Template", generator: exportArm },
  ];

  const currentTab = tabs[tabIndex];

  const getCode = (): string => {
    if (iacError) return iacError;
    try {
      return currentTab.generator();
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      setIacError(msg);
      return `// Error generating ${currentTab.label} configuration:\n// ${msg}`;
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getCode());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleTabChange = (_: React.SyntheticEvent, v: number) => {
    setTabIndex(v);
    setIacError(null);
  };

  return (
    <Dialog open={showModal} onClose={closeExport} maxWidth="md" fullWidth slotProps={{ paper: { sx: { bgcolor: "#18181b", border: 1, borderColor: "#27272a" } } }}>
      <DialogTitle sx={{ color: "text.primary", borderBottom: 1, borderColor: "#27272a", px: 2, py: 1.5 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: "0.95rem" }}>Export Infrastructure as Code</Typography>
      </DialogTitle>
      <DialogContent sx={{ px: 0, pt: 0 }}>
        <Tabs
          value={tabIndex}
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{
            borderBottom: 1, borderColor: "#27272a",
            "& .MuiTab-root": { color: "#a1a1aa", textTransform: "none", fontWeight: 500, fontSize: "0.8rem", minHeight: 40 },
            "& .Mui-selected": { color: "#22c55e !important" },
            "& .MuiTabs-indicator": { bgcolor: "#22c55e" },
          }}
        >
          {tabs.map((t) => <Tab key={t.id} label={t.label} />)}
        </Tabs>
        <Box sx={{ height: 400, borderBottom: 1, borderColor: "#27272a" }}>
          <Editor
            key={`${currentTab.id}-${iacError ?? "ok"}`}
            language={currentTab.id === "kubernetes" || currentTab.id === "deployment-manager" ? "yaml" : currentTab.id === "arm" ? "json" : "hcl"}
            theme="vs-dark"
            value={getCode()}
            options={{ readOnly: true, minimap: { enabled: false }, fontSize: 12, lineNumbers: "on", scrollBeyondLastLine: false, wordWrap: "on" }}
          />
        </Box>
        {iacError && (
          <Box sx={{ px: 2, py: 1, bgcolor: "rgba(239,68,68,0.1)", borderBottom: 1, borderColor: "#27272a" }}>
            <Typography variant="caption" sx={{ color: "#ef4444" }}>
              {iacError}
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2, py: 1, borderTop: 1, borderColor: "#27272a" }}>
        <Button onClick={closeExport} size="small" sx={{ color: "#a1a1aa", textTransform: "none" }}>Close</Button>
        <Button onClick={handleCopy} size="small" variant="contained" sx={{ bgcolor: "#22c55e", color: "#09090b", textTransform: "none", "&:hover": { bgcolor: "#16a34a" } }}>
          {copied ? "Copied!" : "Copy to Clipboard"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
