import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import Editor from "@monaco-editor/react";
import { useExportStore } from "../../store/exportStore";
import { exportTerraform, exportKubernetes, exportCloudFormation, exportTerraformGCP, exportTerraformAzure, exportDeploymentManager, exportArm } from "../../utils/iacExporter";
import { Box, Typography, Button } from "@mui/material";
import { X } from "lucide-react";

interface IaCTab {
  id: string;
  label: string;
  sublabel: string;
  generator: () => string;
}

const TABS: IaCTab[] = [
  { id: "terraform", label: "Terraform", sublabel: "HashiCorp HCL", generator: exportTerraform },
  { id: "terraform-gcp", label: "Terraform (GCP)", sublabel: "Google Cloud", generator: exportTerraformGCP },
  { id: "terraform-azure", label: "Terraform (Azure)", sublabel: "Microsoft Azure", generator: exportTerraformAzure },
  { id: "kubernetes", label: "Kubernetes", sublabel: "K8s YAML", generator: exportKubernetes },
  { id: "cloudformation", label: "CloudFormation", sublabel: "AWS JSON", generator: exportCloudFormation },
  { id: "deployment-manager", label: "Deployment Manager", sublabel: "GCP YAML", generator: exportDeploymentManager },
  { id: "arm", label: "ARM Template", sublabel: "Azure JSON", generator: exportArm },
];

function getLang(id: string): string {
  if (id === "kubernetes" || id === "deployment-manager") return "yaml";
  if (id === "arm") return "json";
  return "hcl";
}

export default function ExportModal() {
  const showModal = useExportStore((s) => s.showModal);
  const closeExport = useExportStore((s) => s.closeExport);
  const [tabIndex, setTabIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [iacError, setIacError] = useState<string | null>(null);

  const currentTab = TABS[tabIndex];

  const code = useMemo(() => {
    if (iacError) return iacError;
    try {
      return currentTab.generator();
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      setIacError(msg);
      return `// Error generating ${currentTab.label} configuration:\n// ${msg}`;
    }
  }, [currentTab, iacError]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const handleTabClick = (i: number) => {
    setTabIndex(i);
    setIacError(null);
  };

  if (!showModal) return null;

  return (
    <Box sx={{
      position: "fixed", inset: 0, zIndex: 1300,
      bgcolor: "rgba(10,10,11,0.92)", backdropFilter: "blur(16px)",
      display: "flex",
    }}>
      {/* Close button */}
      <Box
        onClick={closeExport}
        sx={{
          position: "absolute", top: 16, right: 16, zIndex: 10,
          width: 36, height: 36, borderRadius: "8px",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#8B8B8F", cursor: "pointer",
          transition: "all 0.15s",
          "&:hover": { bgcolor: "#252528", color: "#EDEDEF" },
          "&:focus-visible": { outline: "2px solid #6366F1", outlineOffset: 2 },
        }}
        tabIndex={0}
        role="button"
        aria-label="Close export dialog"
      >
        <X size={20} />
      </Box>

      {/* Left sidebar */}
      <Box sx={{
        width: 200, flexShrink: 0, borderRight: "1px solid #2A2A2E",
        display: "flex", flexDirection: "column", pt: 6, px: 1,
      }}>
        <Typography variant="caption" sx={{
          color: "#8B8B8F", textTransform: "uppercase", letterSpacing: "0.08em",
          fontWeight: 600, fontSize: "0.5rem", mb: 1.5, px: 1,
        }}>
          Providers
        </Typography>
        {TABS.map((tab, i) => (
          <Box
            key={tab.id}
            onClick={() => handleTabClick(i)}
            sx={{
              px: 1.25, py: 1, borderRadius: "6px", cursor: "pointer",
              mb: 0.25, transition: "all 0.12s",
              bgcolor: i === tabIndex ? "#252528" : "transparent",
              "&:hover": { bgcolor: i === tabIndex ? "#252528" : "#1E1E20" },
              "&:focus-visible": { outline: "2px solid #6366F1", outlineOffset: 2 },
            }}
            tabIndex={0}
            role="button"
            onClickCapture={() => handleTabClick(i)}
          >
            <Typography variant="caption" sx={{
              color: i === tabIndex ? "#EDEDEF" : "#8B8B8F",
              fontWeight: i === tabIndex ? 600 : 400,
              fontSize: "0.65rem", display: "block",
            }}>
              {tab.label}
            </Typography>
            <Typography variant="caption" sx={{
              color: "#555558", fontSize: "0.5rem", display: "block", mt: 0.15,
            }}>
              {tab.sublabel}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Main content */}
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Header */}
        <Box sx={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          px: 2.5, py: 1.5, borderBottom: "1px solid #2A2A2E", flexShrink: 0,
        }}>
          <Box>
            <Typography variant="caption" sx={{ color: "#EDEDEF", fontWeight: 600, fontSize: "0.75rem" }}>
              Export Infrastructure as Code
            </Typography>
            <Typography variant="caption" sx={{ color: "#555558", fontSize: "0.55rem", display: "block", mt: 0.15 }}>
              {currentTab.label} — {currentTab.sublabel}
            </Typography>
          </Box>
          <Button
            onClick={handleCopy}
            variant="contained"
            sx={{
              fontSize: "0.65rem", fontWeight: 600, px: 2, py: 0.75,
              bgcolor: copied ? "#22C55E" : "#6366F1",
              color: "#fff",
              "&:hover": { bgcolor: copied ? "#16A34A" : "#4F46E5" },
              "&:focus-visible": { outline: "2px solid #6366F1", outlineOffset: 2 },
              "&:active": { transform: "scale(0.98)" },
              transition: "all 0.12s",
              textTransform: "none", borderRadius: "6px",
            }}
          >
            {copied ? "Copied!" : "Copy Code"}
          </Button>
        </Box>

        {/* Editor */}
        <motion.div
          key={currentTab.id}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.12 }}
          style={{ flex: 1, minHeight: 0 }}
        >
          <Editor
            language={getLang(currentTab.id)}
            theme="vs-dark"
            value={code}
            options={{
              readOnly: true, minimap: { enabled: false },
              fontSize: 13, lineNumbers: "on",
              scrollBeyondLastLine: false, wordWrap: "on",
              padding: { top: 12 },
            }}
          />
        </motion.div>

        {iacError && (
          <Box sx={{ px: 2.5, py: 1, bgcolor: "rgba(239,68,68,0.1)", borderTop: "1px solid #2A2A2E" }}>
            <Typography variant="caption" sx={{ color: "#ef4444", fontSize: "0.6rem" }}>{iacError}</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
