import { GunGraphConnector } from '../@notabug/chaingun'

const EMPTY = {}

export function generateMessageId() {
  return Math.random()
    .toString(36)
    .slice(2)
}

export function addMissingState(graphData: GunGraphData) {
  const updatedGraphData = { ...graphData }
  const now = new Date().getTime()

  for (let soul in graphData) {
    const node = graphData[soul]
    if (!node) continue
    const meta = (node._ = node._ || {})
    meta['#'] = soul
    const state = (meta['>'] = meta['>'] || {})

    for (let key in node) {
      if (key === '_') continue
      state[key] = state[key] || now
    }

    updatedGraphData[soul] = node
  }

  return updatedGraphData
}

const DEFAULT_OPTS = {
  futureGrace: 10 * 60 * 1000,
  Lexical: JSON.stringify // what gun.js uses
}

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
        '#': soul,
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

export function diffSets(initial: string[], updated: string[]) {
  return [
    updated.filter(key => initial.indexOf(key) === -1),
    initial.filter(key => updated.indexOf(key) === -1)
  ]
}

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

export function nodeToGraph(node: GunNode) {
  const modified = { ...node }
  let nodes: GunGraphData = {}
  const nodeSoul = node && node._ && node._['#']

  for (let key in node) {
    if (key === '_') continue
    const val = node[key]
    if (typeof val !== 'object') continue
    const soul = val && val._ && val._['#']

    if (soul) {
      const edge = { '#': soul }
      modified[key] = edge
      const graph = addMissingState(nodeToGraph(val))
      const diff = diffGunCRDT(graph, nodes)
      nodes = diff ? mergeGraph(nodes, diff) : nodes
    }
  }

  const raw = { [nodeSoul]: modified }
  const withMissingState = addMissingState(raw)
  const diff = diffGunCRDT(withMissingState, nodes)
  nodes = diff ? mergeGraph(nodes, diff) : nodes

  return nodes
}

export function flattenGraphData(data: GunGraphData) {
  const graphs: GunGraphData[] = []
  let flatGraph: GunGraphData = {}

  for (let soul in data) {
    const node = data[soul]
    if (node) graphs.push(nodeToGraph(node))
  }

  for (let i = 0; i < graphs.length; i++) {
    const diff = diffGunCRDT(graphs[i], flatGraph)
    flatGraph = diff ? mergeGraph(flatGraph, diff) : flatGraph
  }

  return flatGraph
}

export function getPathData(keys: string[], graph: GunGraphData): PathData {
  const lastKey = keys[keys.length - 1]

  if (keys.length === 1) {
    return {
      souls: keys,
      value: graph[lastKey],
      complete: lastKey in graph
    }
  }

  const { value: parentValue, souls } = getPathData(keys.slice(0, keys.length - 1), graph)

  if (typeof parentValue !== 'object') {
    return {
      souls,
      value: undefined,
      complete: typeof parentValue !== 'undefined'
    }
  }

  const value = (parentValue as GunNode)[lastKey]

  if (!value) {
    return {
      souls,
      value: value,
      complete: true
    }
  }

  const edgeSoul = value['#']

  if (edgeSoul) {
    return {
      souls: [...souls, edgeSoul],
      value: graph[edgeSoul],
      complete: edgeSoul in graph
    }
  }

  return {
    souls,
    value,
    complete: true
  }
}
