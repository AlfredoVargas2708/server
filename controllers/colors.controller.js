import axios from "axios";
import CacheManager from "../utils/cacheManager.js";

const URL = process.env.REBRICKABLE_API_URL || "";
const KEY = process.env.REBRICKABLE_API_KEY || "";

// Caché de colores individuales (10 minutos)
const colorCache = new CacheManager(10 * 60 * 1000);

export const ColorsController = {
  async getColors() {
    const allColors = [];
    let page = 1;
    const page_size = 100;
    let hasMore = true;

    while (hasMore) {
      try {
        const { data } = await axios.get(`${URL}/colors`, {
          headers: {
            Authorization: `key ${KEY}`,
          },
          params: { page, page_size },
        });

        if (data.results && data.results.length > 0) {
          allColors.push(
            ...data.results.filter((result) => result.id !== -1),
          );
          page++;

          // Esperar 100ms entre requests para evitar error 429
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Verificar si hay más páginas
          hasMore = !!data.next;
        } else {
          hasMore = false;
        }
      } catch (error) {
        // Si es error 429, esperar más tiempo y reintentar
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers["retry-after"] || 5;
          console.warn(
            `Rate limited (429). Esperando ${retryAfter} segundos...`,
          );
          await new Promise((resolve) =>
            setTimeout(resolve, retryAfter * 1000),
          );
          // Reintentar la misma página
          continue;
        }
        // Si es otro error, lanzarlo
        throw error;
      }
    }

    return {
      count: allColors.length,
      results: allColors,
    };
  },

  async getColor(color_id) {
    return colorCache.getOrSet(color_id, async () => {
      const { data } = await axios.get(`${URL}/colors/${color_id}`, {
        headers: {
          Authorization: `key ${KEY}`,
        },
      });
      return data;
    });
  },
};
