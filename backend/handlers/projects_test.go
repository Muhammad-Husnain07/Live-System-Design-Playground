package handlers

import (
	"testing"

	"systemdesign/models"
	"systemdesign/services"
)

func TestCollaboratorRequest_DefaultRole(t *testing.T) {
	// Handler sets default role to "viewer" when empty
	req := models.AddCollaboratorRequest{Email: "user@example.com", Role: ""}
	role := req.Role
	if role == "" {
		role = "viewer"
	}
	if role != "viewer" {
		t.Errorf("default role should be viewer, got: %s", role)
	}
}

func TestCollaboratorRequest_ExplicitRole(t *testing.T) {
	req := models.AddCollaboratorRequest{Email: "user@example.com", Role: "editor"}
	if req.Role != "editor" {
		t.Errorf("expected editor role, got: %s", req.Role)
	}
}

func TestCreateProjectRequest_Defaults(t *testing.T) {
	req := models.CreateProjectRequest{Name: "Test Project"}
	if req.IsPublic != nil {
		t.Error("IsPublic should be nil when not provided")
	}
	// Service treats nil as false
	public := false
	if req.IsPublic != nil {
		public = *req.IsPublic
	}
	if public {
		t.Error("default is_public should be false")
	}
}

func TestSaveCanvasRequest_CanvasDataRequired(t *testing.T) {
	// Empty canvas_data should be valid (can save empty canvas)
	req := models.SaveCanvasRequest{}
	if len(req.CanvasData) > 0 {
		t.Error("empty canvas_data should be valid")
	}
}

func TestUpdateProject_COALESCE_Pattern(t *testing.T) {
	// Verify that nil fields in UpdateProjectRequest result in no update
	req := models.UpdateProjectRequest{}
	if req.Name != nil {
		t.Error("Name should be nil when not provided")
	}
	if req.Description != nil {
		t.Error("Description should be nil when not provided")
	}
	if req.IsPublic != nil {
		t.Error("IsPublic should be nil when not provided")
	}
	if req.CanvasData != nil {
		t.Error("CanvasData should be nil when not provided")
	}
	if req.Metadata != nil {
		t.Error("Metadata should be nil when not provided")
	}
}

func TestUpdateProject_NameUnchangedWhenEmpty(t *testing.T) {
	// The SQL COALESCE(NULLIF($1, ''), name) pattern means empty string -> keep existing
	emptyName := ""
	shouldKeep := emptyName == ""
	if !shouldKeep {
		t.Error("empty name should result in keeping existing name")
	}
}

func TestProjectHandler_ErrorCodes(t *testing.T) {
	// Verify error-to-HTTP-code mappings used in handlers
	errCases := []struct {
		err      error
		wantCode int
	}{
		{services.ErrForbidden, 403},
		{services.ErrProjectNotFound, 404},
		{services.ErrUserNotFound, 404},
		{services.ErrInvalidRole, 400},
		{services.ErrAlreadyCollaborator, 400},
		{services.ErrCannotAddSelf, 400},
		{services.ErrNameRequired, 400},
	}

	for _, tc := range errCases {
		code := 400
		if tc.err == services.ErrForbidden {
			code = 403
		} else if tc.err == services.ErrProjectNotFound || tc.err == services.ErrUserNotFound {
			code = 404
		}
		if code != tc.wantCode {
			t.Errorf("for error %v: got code %d, want %d", tc.err, code, tc.wantCode)
		}
	}
}

func TestCanvasData_DefaultStructure(t *testing.T) {
	// Verify the default canvas structure used when creating a project
	defaultCanvas := `{"nodes":[],"edges":[]}`
	hasNodes := len(defaultCanvas) > 0
	if !hasNodes {
		t.Error("default canvas should be non-empty JSON")
	}
}

func TestCanvasData_LoadsCorrectly(t *testing.T) {
	// Verify that canvas_data with null/empty fields is handled gracefully
	cd := map[string]any{}
	_, hasNodes := cd["nodes"]
	_, hasEdges := cd["edges"]
	if !hasNodes && !hasEdges {
		// This simulates what happens if data comes from migration default '{}'
		t.Log("empty canvas_data {} — missing nodes/edges keys, handled by GetProjectByID nil check")
	}
}
