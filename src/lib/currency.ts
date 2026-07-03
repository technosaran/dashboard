let cachedRate = 83.5;
let lastFetched = 0;
const CACHE_DURATION_MS = 3600000; // Cache for 1 hour

export async function getUsdToInrRate(): Promise<number> {
  const now = Date.now();
  if (now - lastFetched < CACHE_DURATION_MS) {
    return cachedRate;
  }

  // 1. Try open.er-api
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      next: { revalidate: 3600 }
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.rates && typeof data.rates.INR === "number") {
        cachedRate = data.rates.INR;
        lastFetched = now;
        return cachedRate;
      }
    }
  } catch (err) {
    console.warn("Primary forex API failed, trying fallback 1:", err);
  }

  // 2. Try Exchangerate-API fallback
  try {
    const res = await fetch("https://api.exchangerate-api.com/v4/latest/USD", {
      next: { revalidate: 3600 }
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.rates && typeof data.rates.INR === "number") {
        cachedRate = data.rates.INR;
        lastFetched = now;
        return cachedRate;
      }
    }
  } catch (err) {
    console.warn("Secondary forex API failed, trying fallback 2:", err);
  }

  // 3. Try Frankfurter API fallback
  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=USD&to=INR", {
      next: { revalidate: 3600 }
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.rates && typeof data.rates.INR === "number") {
        cachedRate = data.rates.INR;
        lastFetched = now;
        return cachedRate;
      }
    }
  } catch (err) {
    console.error("All forex APIs failed, using cached rate:", err);
  }

  return cachedRate;
}
