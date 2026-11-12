/**
 * Device capability detection (mobile vs desktop/laptop).
 */

export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;

  // Check User-Agent Client Hints if available
  const nav = navigator as unknown as { userAgentData?: { mobile?: boolean } };
  if (nav.userAgentData?.mobile !== undefined) {
    return !!nav.userAgentData.mobile;
  }

  // Classic User-Agent pattern match
  const ua = navigator.userAgent || '';
  if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    return true;
  }

  // Touch screen + small width fallback (e.g. tablet/mobile devices emulating or reporting general UA)
  if (
    ('ontouchstart' in window || navigator.maxTouchPoints > 0) &&
    window.matchMedia('(pointer: coarse)').matches &&
    window.innerWidth <= 1024
  ) {
    return true;
  }

  return false;
}

