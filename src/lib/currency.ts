let cachedRate = 83.5;
let lastFetched = 0;
const CACHE_DURATION_MS = 3600000; // Cache for 1 hour

export async function getUsdToInrRate(): Promise<number> {
  const now = Date.now();
  if (now - lastFetched < CACHE_DURATION_MS) {
    return cachedRate;
  }

  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      next: { revalidate: 3600 } // Next.js fetch cache integration
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.rates && typeof data.rates.INR === "number") {
        cachedRate = data.rates.INR;
        lastFetched = now;
      }
    }
  } catch (err) {
    console.error("Failed to fetch live USD/INR exchange rate:", err);
  }

  return cachedRate;
}
