/**
 * Authoritative Release build information for BATTLE CITY 2026.
 * Used for diagnostic error reporting, boot logging, and UI version badging.
 */
export const BUILD_INFO = {
  name: 'BATTLE CITY 2026',
  channel: 'DEV',
  version: '1.2.0-dev',
  buildDate: '2026-09-12',
} as const;

export function getBuildDiagnosticString(): string {
  return `${BUILD_INFO.name} v${BUILD_INFO.version} [${BUILD_INFO.channel}] (${BUILD_INFO.buildDate})`;
}
