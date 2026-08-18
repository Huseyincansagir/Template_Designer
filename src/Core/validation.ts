import type { Project } from "../Domain/models";

export type ValidationSeverity = "info" | "warning" | "error";

export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  message: string;
  path?: string;
  remediation?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: readonly ValidationIssue[];
}

export function validateProject(project: Project): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (project.name.trim().length === 0) {
    issues.push({
      severity: "error",
      code: "PROJECT_NAME_REQUIRED",
      message: "Project name is required.",
      path: "name",
      remediation: "Provide a non-empty project name.",
    });
  }

  if (project.schemaVersion < 1) {
    issues.push({
      severity: "error",
      code: "PROJECT_SCHEMA_UNSUPPORTED",
      message: "Project schema version is not supported.",
      path: "schemaVersion",
      remediation: "Migrate the project to schema version 1 or newer.",
    });
  }

  if (project.deviceProfileId.trim().length === 0) {
    issues.push({
      severity: "error",
      code: "DEVICE_PROFILE_REQUIRED",
      message: "A device profile must be selected.",
      path: "deviceProfileId",
      remediation: "Select a device profile before editing the project.",
    });
  }

  return {
    valid: issues.every((issue) => issue.severity !== "error"),
    issues,
  };
}
