import type { DepartmentMember, DepartmentMemberRole } from "@/lib/api";

export const PRESIDIUM_ROLES: DepartmentMemberRole[] = [
  "HEAD",
  "FIRST_DEPUTY",
  "SECRETARY",
  "DEPUTY",
  "HR",
];

export const ROLE_LABEL: Record<DepartmentMemberRole, string> = {
  HEAD: "Голова студради",
  FIRST_DEPUTY: "Перший заступник",
  SECRETARY: "Секретар",
  DEPUTY: "Заступник",
  HR: "HR",
  MEMBER: "Учасник",
};

export function presidiumMembers(
  members: DepartmentMember[],
): DepartmentMember[] {
  const rank = (m: DepartmentMember) => PRESIDIUM_ROLES.indexOf(m.role);
  return members
    .filter((m) => rank(m) !== -1)
    .sort(
      (a, b) =>
        rank(a) - rank(b) ||
        (a.order ?? 0) - (b.order ?? 0) ||
        a.lastName.localeCompare(b.lastName, "uk"),
    );
}

export function presidiumTitle(m: DepartmentMember): string {
  const title = m.title?.trim();
  if (title) return title;
  const label = ROLE_LABEL[m.role] ?? m.role;
  const detail = m.specialization?.trim();
  return detail ? `${label} | ${detail}` : label;
}
