import { create } from "zustand";

export type ExportFormat = "terraform" | "kubernetes" | "cloudformation";

export const EXPORT_FORMATS: { value: ExportFormat; label: string; lang: string; ext: string }[] = [
  { value: "terraform", label: "Terraform", lang: "hcl", ext: "tf" },
  { value: "kubernetes", label: "Kubernetes", lang: "yaml", ext: "yaml" },
  { value: "cloudformation", label: "CloudFormation", lang: "json", ext: "json" },
];

export const NODE_COMPAT: Record<string, "supported" | "skipped"> = {
  LoadBalancer: "supported",
  APIGateway: "supported",
  WebServer: "supported",
  AppServer: "supported",
  Microservice: "supported",
  PostgreSQLDB: "supported",
  MySQLDB: "supported",
  MongoDB: "supported",
  Redis: "supported",
  Elasticsearch: "supported",
  CDN: "supported",
  DNS: "supported",
  Firewall: "supported",
  VPC: "supported",
  Subnet: "supported",
  MessageQueue: "supported",
  EventBus: "supported",
  PubSub: "supported",
  ContainerCluster: "supported",
  ServerlessFunction: "supported",
  BatchProcessor: "supported",
  WorkerService: "supported",
  ExternalClient: "skipped",
  ThirdPartyAPI: "skipped",
  MobileClient: "skipped",
  WebBrowser: "skipped",
};

interface ExportState {
  showModal: boolean;
  content: string;
  format: ExportFormat;
  loading: boolean;
  error: string | null;
  filename: string;

  openExport: () => void;
  closeExport: () => void;
  setContent: (content: string) => void;
  setFormat: (format: ExportFormat) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setFilename: (filename: string) => void;
}

export const useExportStore = create<ExportState>((set) => ({
  showModal: false,
  content: "",
  format: "terraform",
  loading: false,
  error: null,
  filename: "",

  openExport: () => set({ showModal: true, content: "", error: null, format: "terraform" }),
  closeExport: () => set({ showModal: false, content: "", error: null, loading: false }),
  setContent: (content) => set({ content, error: null }),
  setFormat: (format) => set({ format }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setFilename: (filename) => set({ filename }),
}));
