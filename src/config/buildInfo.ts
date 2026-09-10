/**
 * Authoritative Release build information for BATTLE CITY 2026.
 * Used for diagnostic error reporting, boot logging, and UI version badging.
 */
export const BUILD_INFO = {
  name: 'BATTLE CITY 2026',
  channel: 'RELEASE',
  version: '1.1.0',
  buildDate: '2026-09-11',
} as const;

export function getBuildDiagnosticString(): string {
  return `${BUILD_INFO.name} v${BUILD_INFO.version} [${BUILD_INFO.channel}] (${BUILD_INFO.buildDate})`;
}
