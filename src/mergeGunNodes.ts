export function mergeGunNodes(existing: GunNode | undefined, updates: GunNode | undefined) {
  if (!existing) return updates
  if (!updates) return existing
  const existingMeta = existing._
  return {
    ...existing,
    ...updates,
    _: {
      '#': existingMeta['#'],
      '>': {
        ...existingMeta['>'],
        ...updates._['>']
      }
    }
  }
}
