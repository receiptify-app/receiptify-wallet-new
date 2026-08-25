export const GEOLOCATION_TIMEOUT_MS = 5000;

export function getCurrentPositionOrNull(
  timeoutMs = GEOLOCATION_TIMEOUT_MS,
): Promise<GeolocationPosition | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const settle = (position: GeolocationPosition | null) => {
      if (settled) return;
      settled = true;
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      resolve(position);
    };
    timeoutId = setTimeout(() => settle(null), timeoutMs);

    try {
      navigator.geolocation.getCurrentPosition(
        (position) => settle(position),
        () => settle(null),
        {
          timeout: timeoutMs,
          enableHighAccuracy: true,
        },
      );
    } catch {
      settle(null);
    }
  });
}