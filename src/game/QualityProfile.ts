/**
 * Quality profile configuration and runtime device detection.
 * Balances visual fidelity on desktop with GPU/thermal sustainability on mobile devices.
 */
export interface QualityProfile {
  isMobile: boolean;
  shadowMapSize: number;       // 1024 desktop, 512 mobile
  brickFragmentCount: number;  // 6 desktop, 4 mobile
  tankSparkCount: number;      // 8 desktop, 5 mobile
  maxDpr: number;              // 2.0 desktop, 1.5 mobile
}

/**
 * Detects the runtime quality profile based on pointer capabilities and viewport dimensions.
 * Avoids fragile user-agent sniffing.
 */
export function detectQualityProfile(): QualityProfile {
  if (typeof window === 'undefined') {
    // Default safe fallback for Node/testing environments
    return {
      isMobile: false,
      shadowMapSize: 1024,
      brickFragmentCount: 6,
      tankSparkCount: 8,
      maxDpr: 2.0,
    };
  }

  const hasTouch = 'ontouchstart' in window || (Boolean(navigator.maxTouchPoints) && navigator.maxTouchPoints > 0);
  const isCoarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const isNarrowScreen = window.innerWidth <= 1024;
  const isMobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
  const urlParam = typeof window !== 'undefined' && window.location?.search
    ? new URLSearchParams(window.location.search).get('mobile')
    : null;

  const isMobile = Boolean(
    urlParam === 'true' ||
    urlParam === '1' ||
    (hasTouch && isCoarsePointer) ||
    (hasTouch && isNarrowScreen) ||
    (isNarrowScreen && isMobileUA) ||
    isCoarsePointer
  );

  return {
    isMobile,
    shadowMapSize: isMobile ? 512 : 1024,
    brickFragmentCount: isMobile ? 4 : 6,
    tankSparkCount: isMobile ? 5 : 8,
    maxDpr: isMobile ? 1.5 : 2.0,
  };
}
