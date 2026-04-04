/**
 * Builds a server-safe context id for persisted ownership graphs (parent + OpCo scope).
 */
export function buildOwnershipGraphContextId(parentHolding, opco) {
  const slug = (s) =>
    String(s || '')
      .trim()
      .replace(/[^a-zA-Z0-9._\-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 120);
  const a = slug(parentHolding);
  const b = slug(opco || 'all');
  if (!a) return '';
  return `${a}::${b}`;
}
