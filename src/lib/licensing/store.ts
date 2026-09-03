/**
 * Legacy compatibility shim.
 *
 * UCE is fully free and open source. Scan counts are no longer tracked or
 * restricted; this function intentionally performs no persistence.
 */
export function incrementScanCount(): void {
  // Intentionally empty: UCE has no scan limits.
}
