import { mergeGraph } from './mergeGunNodes'
import { diffGunCRDT } from './diffGunCRDT'
import { addMissingState } from './addMissingState'

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
