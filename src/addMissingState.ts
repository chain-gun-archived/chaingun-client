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
