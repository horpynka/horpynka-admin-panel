export const PANEL_ADMIN_ROLE = "HORPYNKA_PANEL_ADMIN";
export const CASHIER_ROLE = "HORPYNKA_CASHIER_USER";

export const ASSIGNABLE_ROLES = [PANEL_ADMIN_ROLE, CASHIER_ROLE] as const;

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export function isAssignableRole(role: string): role is AssignableRole {
  return (ASSIGNABLE_ROLES as readonly string[]).includes(role);
}

export function hasPanelAccess(roles: readonly string[]): boolean {
  return roles.includes(PANEL_ADMIN_ROLE);
}

/**
 * The generated client types a unique role list as Set, then JSON.stringifies the body.
 * A real Set becomes `{}`. The API expects a JSON array, so this keeps the array at runtime.
 */
export function toApiRoles(roles: readonly AssignableRole[]): Set<AssignableRole> {
  return [...roles] as unknown as Set<AssignableRole>;
}
