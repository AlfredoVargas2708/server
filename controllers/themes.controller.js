import axios from "axios";
import CacheManager from "../utils/cacheManager.js";

const URL =
  process.env.REBRICKABLE_API_URL || "https://rebrickable.com/api/v3/lego";
const KEY = process.env.REBRICKABLE_API_KEY || "";

// Los temas de Rebrickable rara vez cambian; 1 hora de caché evita llamadas innecesarias
const CACHE_TTL = 60 * 60 * 1000;
const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 1000;

// Caché en memoria
const allThemesCache = new CacheManager(CACHE_TTL);
const THEMES_CACHE_KEY = "all";

// Evita múltiples peticiones simultáneas si la caché está vacía (Request Coalescing)
let inFlightAllThemesPromise = null;

const api = axios.create({
  baseURL: URL,
  headers: {
    Authorization: `key ${KEY}`,
  },
  timeout: 10000,
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getRetryDelay = (retryCount, retryAfterHeader) => {
  if (retryAfterHeader) {
    const retryAfter = parseInt(retryAfterHeader, 10);
    if (!isNaN(retryAfter)) return retryAfter * 1000;
  }
  // Backoff exponencial + jitter (0-300ms) para evitar reintentos simultáneos
  const jitter = Math.floor(Math.random() * 300);
  return INITIAL_BACKOFF_MS * Math.pow(2, retryCount) + jitter;
};

// Wrapper reutilizable con manejo de Rate Limit (429)
async function fetchWithRetry(endpoint, params = {}) {
  for (let retryCount = 0; retryCount < MAX_RETRIES; retryCount++) {
    try {
      const { data } = await api.get(endpoint, { params });
      return data;
    } catch (error) {
      if (error.response?.status === 429 && retryCount < MAX_RETRIES - 1) {
        const retryAfter = error.response.headers["retry-after"];
        const delay = getRetryDelay(retryCount, retryAfter);
        console.warn(
          `Rate limited (429) en ${endpoint}. Reintento ${retryCount + 1}/${MAX_RETRIES} en ${delay}ms...`,
        );
        await sleep(delay);
      } else {
        throw error;
      }
    }
  }
}

export const ThemesController = {
  async getThemes() {
    // 1. Devolver desde caché si sigue vigente (0ms, 0 peticiones)
    const cachedThemes = allThemesCache.get(THEMES_CACHE_KEY);
    if (cachedThemes !== null) {
      return {
        count: cachedThemes.data.length,
        results: cachedThemes.data,
      };
    }

    // 2. Si ya hay una petición en curso, reutilizar esa promesa
    if (inFlightAllThemesPromise) {
      return inFlightAllThemesPromise;
    }

    inFlightAllThemesPromise = (async () => {
      try {
        const allThemesById = new Map();
        let page = 1;
        // Rebrickable soporta hasta 1000 por página (trae todos los temas en 1 sola petición)
        const page_size = 1000;
        let hasMore = true;

        while (hasMore) {
          const data = await fetchWithRetry("/themes/", { page, page_size });

          if (data?.results?.length > 0) {
            for (const theme of data.results) {
              allThemesById.set(theme.id, theme);
            }
            page++;
            hasMore = Boolean(data.next);
          } else {
            hasMore = false;
          }
        }

        const themesByName = new Map();
        for (const theme of allThemesById.values()) {
          const name = theme.name.trim().toLowerCase();
          const currentTheme = themesByName.get(name);

          if (!currentTheme || (currentTheme.parent_id && !theme.parent_id)) {
            themesByName.set(name, theme);
          }
        }

        const allThemes = [...themesByName.values()];

        allThemesCache.set(THEMES_CACHE_KEY, {
          data: allThemes,
          byId: allThemesById,
        });

        return {
          count: allThemes.length,
          results: allThemes,
        };
      } finally {
        inFlightAllThemesPromise = null;
      }
    })();

    return inFlightAllThemesPromise;
  },

  async getTheme(theme_id) {
    const id = Number(theme_id);

    // Aseguramos tener el catálogo completo en caché (1 sola petición total)
    let cachedThemes = allThemesCache.get(THEMES_CACHE_KEY);
    if (cachedThemes === null) {
      await this.getThemes();
      cachedThemes = allThemesCache.get(THEMES_CACHE_KEY);
    }

    // Búsqueda O(1) en memoria sin gastar peticiones de API
    let theme = cachedThemes.byId.get(id);

    // Fallback por si el ID no estaba en el listado general
    if (!theme) {
      theme = await fetchWithRetry(`/themes/${id}/`);
      cachedThemes.byId.set(id, theme);
    }

    // Si tiene parent_id, lo sacamos directamente del Map en memoria (0 peticiones extra)
    if (theme.parent_id) {
      let parentTheme = cachedThemes.byId.get(theme.parent_id);

      if (!parentTheme) {
        parentTheme = await fetchWithRetry(`/themes/${theme.parent_id}/`);
        cachedThemes.byId.set(theme.parent_id, parentTheme);
      }

      return parentTheme;
    }

    return theme;
  },
};
