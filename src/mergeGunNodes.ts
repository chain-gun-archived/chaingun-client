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

export function mergeGraph(existing: GunGraphData, diff: GunGraphData) {
  const result: GunGraphData = { ...existing }
  for (let soul in diff) {
    result[soul] = mergeGunNodes(existing[soul], diff[soul])
  }
  return result
}
