const DEFAULT_OPTS = {
  futureGrace: 10 * 60 * 1000,
  Lexical: JSON.stringify // what gun.js uses
}

const EMPTY = {}

export function diffGunCRDT(
  updatedGraph: GunGraphData,
  existingGraph: GunGraphData,
  opts: {
    machineState?: number
    futureGrace?: number
    Lexical?: (x: GunValue) => any
  } = DEFAULT_OPTS
) {
  const {
    machineState = new Date().getTime(),
    futureGrace = DEFAULT_OPTS.futureGrace,
    Lexical = DEFAULT_OPTS.Lexical
  } = opts || EMPTY
  const maxState = machineState + futureGrace // eslint-disable-line

  const allUpdates: GunGraphData = {}

  for (let soul in updatedGraph) {
    const existing = existingGraph[soul]
    const updated = updatedGraph[soul]
    const existingState: GunNodeState = (existing && existing._ && existing._['>']) || EMPTY
    const updatedState: GunNodeState = (updated && updated._ && updated._['>']) || EMPTY

    if (!updated) {
      if (!(soul in existingGraph)) allUpdates[soul] = updated
      continue
    }

    let hasUpdates = false

    const updates: GunNode = {
      _: {
        '#': updated._['#'],
        '>': {} as GunNodeState
      }
    }

    for (let key in updatedState) {
      const existingKeyState = existingState[key]
      const updatedKeyState = updatedState[key]

      if (updatedKeyState > maxState || !updatedKeyState) continue
      if (existingKeyState && existingKeyState >= updatedKeyState) continue
      if (existingKeyState === updatedKeyState) {
        const existingVal = (existing && existing[key]) || undefined
        const updatedVal = updated[key]
        // This is based on Gun's logic
        if (Lexical(updatedVal) <= Lexical(existingVal)) continue
      }
      updates[key] = updated[key]
      updates._['>'][key] = updatedKeyState
      hasUpdates = true
    }

    if (hasUpdates) {
      allUpdates[soul] = updates
    }
  }

  return Object.keys(allUpdates) ? allUpdates : undefined
}
