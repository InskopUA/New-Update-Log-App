export const appRoles = ["owner", "admin", "dispatcher", "viewer"] as const;

export type AppRole = (typeof appRoles)[number];

const roleLabels: Record<AppRole, string> = {
  owner: "Owner",
  admin: "Admin",
  dispatcher: "Dispatcher",
  viewer: "Viewer"
};

const managementRoles: AppRole[] = ["owner", "admin"];

export function roleLabel(role: string) {
  return roleLabels[role as AppRole] ?? role;
}

export function canManageTeam(role?: string | null) {
  return managementRoles.includes(role as AppRole);
}
