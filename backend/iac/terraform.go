package iac

import (
	"bytes"
	"fmt"
	"sort"
	"strings"
	"text/template"
)

const terraformTemplate = `# Terraform configuration generated from system design canvas
# Provider: {{.Provider}}

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

{{range .Resources}}
{{- if .DependsOn}}
resource {{.Type | quote}} {{SanitizeID .ID | quote}} {
  {{- range $k, $v := .Properties}}
  {{$k}} = {{formatValue $v}}
  {{- end}}
  depends_on = [
    {{- range $i, $d := .DependsOn}}
    {{$d | quote}},
    {{- end}}
  ]
}
{{- else}}
resource {{.Type | quote}} {{SanitizeID .ID | quote}} {
  {{- range $k, $v := .Properties}}
  {{$k}} = {{formatValue $v}}
  {{- end}}
}
{{- end}}
{{end}}
`

var terraformFuncs = template.FuncMap{
	"SanitizeID": SanitizeID,
	"quote":      Quote,
	"formatValue": func(v any) string {
		switch val := v.(type) {
		case string:
			if val == "" {
				return `""`
			}
			return fmt.Sprintf("%q", val)
		case float64:
			if val == float64(int(val)) {
				return fmt.Sprintf("%d", int(val))
			}
			return fmt.Sprintf("%g", val)
		case int:
			return fmt.Sprintf("%d", val)
		case bool:
			if val {
				return "true"
			}
			return "false"
		default:
			return fmt.Sprintf("%q", fmt.Sprintf("%v", v))
		}
	},
}

type terraformData struct {
	Provider  string
	Resources []Resource
}

func GenerateTerraform(data ExportData) (string, error) {
	tmpl, err := template.New("terraform").Funcs(terraformFuncs).Parse(terraformTemplate)
	if err != nil {
		return "", fmt.Errorf("template parse error: %w", err)
	}

	sort.Slice(data.Resources, func(i, j int) bool {
		return data.Resources[i].Type < data.Resources[j].Type
	})

	td := terraformData{
		Provider:  "aws",
		Resources: data.Resources,
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, td); err != nil {
		return "", fmt.Errorf("template execute error: %w", err)
	}

	return buf.String(), nil
}

func GenerateTerraformJSON(data ExportData) (string, error) {
	var sb strings.Builder
	sb.WriteString("{\n")
	sb.WriteString("  \"resource\": {\n")

	byType := make(map[string][]Resource)
	for _, r := range data.Resources {
		byType[r.Type] = append(byType[r.Type], r)
	}

	types := make([]string, 0, len(byType))
	for t := range byType {
		types = append(types, t)
	}
	sort.Strings(types)

	firstType := true
	for _, t := range types {
		if !firstType {
			sb.WriteString(",\n")
		}
		firstType = false
		sb.WriteString(fmt.Sprintf("    %q: {\n", t))
		for i, r := range byType[t] {
			if i > 0 {
				sb.WriteString(",\n")
			}
			sb.WriteString(fmt.Sprintf("      %q: {\n", SanitizeID(r.ID)))
			propKeys := make([]string, 0, len(r.Properties))
			for k := range r.Properties {
				propKeys = append(propKeys, k)
			}
			sort.Strings(propKeys)
			for _, k := range propKeys {
				v := r.Properties[k]
				sb.WriteString(fmt.Sprintf("        %q: %s,\n", k, jsonValue(v)))
			}
			sb.WriteString("      }")
		}
		sb.WriteString("\n    }")
	}

	sb.WriteString("\n  }\n}")
	return sb.String(), nil
}

func jsonValue(v any) string {
	switch val := v.(type) {
	case string:
		return fmt.Sprintf("%q", val)
	case float64:
		if val == float64(int(val)) {
			return fmt.Sprintf("%d", int(val))
		}
		return fmt.Sprintf("%g", val)
	case bool:
		if val {
			return "true"
		}
		return "false"
	default:
		return fmt.Sprintf("%q", fmt.Sprintf("%v", v))
	}
}
