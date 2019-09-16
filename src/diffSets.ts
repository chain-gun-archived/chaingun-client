export function diffSets(initial: string[], updated: string[]) {
  return [
    updated.filter(key => initial.indexOf(key) === -1),
    initial.filter(key => updated.indexOf(key) === -1)
  ]
}
