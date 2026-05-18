package iac

import (
	"bytes"
	"fmt"
	"sort"
	"text/template"
)

const cfTemplate = `{
  "AWSTemplateFormatVersion": "2010-09-09",
  "Description": "CloudFormation template generated from system design canvas",
  "Resources": {
{{- range $i, $r := .Resources}}
{{- if $i}},{{end}}
    {{$r.ID | quote}}: {
      "Type": {{$r.Type | quote}},
      "Properties": {
{{- $props := $r.Properties}}
{{- $ks := keys $props}}
{{- range $j, $k := $ks}}
{{- if $j}},{{end}}
        {{$k | quote}}: {{prop $props $k}}
{{- end}}
      }
    }
{{- end}}
  }
}
`

var cfFuncs = template.FuncMap{
	"quote": Quote,
	"keys": func(m map[string]any) []string {
		ks := make([]string, 0, len(m))
		for k := range m {
			ks = append(ks, k)
		}
		sort.Strings(ks)
		return ks
	},
	"prop": func(m map[string]any, k string) string {
		v, ok := m[k]
		if !ok {
			return `""`
		}
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
	},
}

func GenerateCloudFormation(data ExportData) (string, error) {
	tmpl, err := template.New("cf").Funcs(cfFuncs).Parse(cfTemplate)
	if err != nil {
		return "", fmt.Errorf("template parse error: %w", err)
	}

	sort.Slice(data.Resources, func(i, j int) bool {
		return data.Resources[i].Type < data.Resources[j].Type
	})

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("template execute error: %w", err)
	}

	return buf.String(), nil
}
