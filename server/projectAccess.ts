export type ProjectOwnershipRecord = {
  userId: number;
  parentId: number | null;
};

export function isOwnedProject(
  project: ProjectOwnershipRecord | undefined,
  userId: number,
  options: { parentOnly?: boolean } = {},
): boolean {
  if (!project || project.userId !== userId) return false;
  if (options.parentOnly && project.parentId !== null) return false;
  return true;
}
