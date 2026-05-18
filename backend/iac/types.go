package iac

type ExportFormat string

const (
	FormatTerraform     ExportFormat = "terraform"
	FormatKubernetes    ExportFormat = "kubernetes"
	FormatCloudFormation ExportFormat = "cloudformation"
)

type Resource struct {
	ID         string
	Type       string
	Provider   string
	Properties map[string]any
	DependsOn  []string
}

type PortMapping struct {
	Protocol    string
	Port        int
	TargetPort  int
}

type ContainerSpec struct {
	Image   string
	Ports   []PortMapping
	Env     map[string]string
	Replicas int
	CPU     string
	Memory  string
}

type ResourceGroup struct {
	Provider   string
	Category   string
	Resources  []Resource
	Containers []ContainerSpec
}

type ExportData struct {
	ProjectID    string
	ProjectName  string
	Resources    []Resource
	ResourceByID map[string]Resource
	Edges        []Edge
	Groups       []ResourceGroup
}

type Edge struct {
	Source string
	Target string
}

type CanvasNodeData struct {
	ID       string                 `json:"id"`
	NodeType string                 `json:"nodeType"`
	Data     map[string]any         `json:"data"`
}

type CanvasEdgeData struct {
	ID     string `json:"id"`
	Source string `json:"source"`
	Target string `json:"target"`
}

type CanvasData struct {
	Nodes []CanvasNodeData `json:"nodes"`
	Edges []CanvasEdgeData `json:"edges"`
}
