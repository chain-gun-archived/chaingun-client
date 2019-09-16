export function generateMessageId() {
  return Math.random()
    .toString(36)
    .slice(2)
}
