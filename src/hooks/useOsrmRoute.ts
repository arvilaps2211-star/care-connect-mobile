import { useEffect, useState } from "react";

export interface OsrmRoute {
  /** [lat, lng] pairs along the route */
  coordinates: [number, number][];
  /** meters */
  distance: number;
  /** seconds */
  duration: number;
  summary: string;
}

interface Args {
  from: { lat: number; lng: number } | null;
  to: { lat: number; lng: number } | null;
  /** Request alternative routes (default true). */
  alternatives?: boolean;
}

/**
 * Fetches a driving route from the public OSRM demo server.
 * No API key required. Use sparingly (rate limits apply).
 */
export function useOsrmRoute({ from, to, alternatives = true }: Args) {
  const [routes, setRoutes] = useState<OsrmRoute[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!from || !to) {
      setRoutes([]);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${from.lng},${from.lat};${to.lng},${to.lat}` +
      `?overview=full&geometries=geojson&alternatives=${alternatives ? "true" : "false"}&steps=false`;

    fetch(url, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.code !== "Ok" || !data.routes?.length) {
          setError(data.message || "No route found");
          setRoutes([]);
          return;
        }
        const parsed: OsrmRoute[] = data.routes.map((r: any, idx: number) => ({
          coordinates: (r.geometry.coordinates as [number, number][]).map(
            ([lng, lat]) => [lat, lng] as [number, number]
          ),
          distance: r.distance,
          duration: r.duration,
          summary:
            idx === 0
              ? "Fastest"
              : idx === 1
              ? "Alternative"
              : `Route ${idx + 1}`,
        }));
        setRoutes(parsed);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(err.message || "Failed to load route");
        }
      })
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [from?.lat, from?.lng, to?.lat, to?.lng, alternatives]);

  return { routes, loading, error };
}