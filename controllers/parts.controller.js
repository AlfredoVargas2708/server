import axios from "axios";
import { ThemesController } from "./themes.controller.js";
import { ColorsController } from "./colors.controller.js";
import CacheManager from "../utils/cacheManager.js";
import { normalizeSet } from "../utils/getNestesValue.js";

const URL = process.env.REBRICKABLE_API_URL || "";
const KEY = process.env.REBRICKABLE_API_KEY || "";

// Caché de colores por parte (10 minutos)
const partColorsCache = new CacheManager(10 * 60 * 1000);

const getCachedPartColors = async (part_num) => {
  const cached = partColorsCache.get(part_num);
  if (cached !== null) {
    return cached;
  }

  let allResults = [];
  let currentPage = 1;
  const pageSize = 100;
  let hasMore = true;

  while (hasMore) {
    try {
      const { data: colorsData } = await axios.get(
        `${URL}/parts/${part_num}/colors`,
        {
          params: { page: currentPage, page_size: pageSize },
          headers: {
            Authorization: `key ${KEY}`,
          },
        },
      );

      if (colorsData.results && colorsData.results.length > 0) {
        allResults.push(...colorsData.results);
        currentPage++;

        // Esperar solo 50ms entre requests
        await new Promise((resolve) => setTimeout(resolve, 50));

        hasMore = !!colorsData.next;
      } else {
        hasMore = false;
      }
    } catch (error) {
      if (error.response?.status === 429) {
        const retryAfter = error.response.headers["retry-after"] || 2;
        console.warn(`Rate limited (429). Esperando ${retryAfter} segundos...`);
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
        continue;
      }
      throw error;
    }
  }

  partColorsCache.set(part_num, allResults);
  return allResults;
};

// Caché de sets por parte (10 minutos)
const partSetsCache = new CacheManager(10 * 60 * 1000);
const partSetsInFlight = new Map();

const getCachedPartSets = async (part_num, color_id) => {
  const cacheKey = `${part_num}-${color_id}`;
  const cached = partSetsCache.get(cacheKey);
  if (cached !== null) {
    return cached;
  }

  const inFlightRequest = partSetsInFlight.get(cacheKey);
  if (inFlightRequest) {
    return inFlightRequest;
  }

  const request = (async () => {
    let allResults = [];
    let currentPage = 1;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      try {
        const { data: setsData } = await axios.get(
          `${URL}/parts/${part_num}/colors/${color_id}/sets`,
          {
            params: { page: currentPage, page_size: pageSize },
            headers: {
              Authorization: `key ${KEY}`,
            },
          },
        );

        if (setsData.results && setsData.results.length > 0) {
          allResults.push(...setsData.results);
          currentPage++;

          // Mantener una pausa entre páginas para evitar exceder el límite de la API.
          if (setsData.next) {
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
          hasMore = !!setsData.next;
        } else {
          hasMore = false;
        }
      } catch (error) {
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers["retry-after"] || 2;
          console.warn(
            `Rate limited (429). Esperando ${retryAfter} segundos...`,
          );
          await new Promise((resolve) =>
            setTimeout(resolve, retryAfter * 1000),
          );
          continue;
        }
        throw error;
      }
    }

    partSetsCache.set(cacheKey, allResults);
    return allResults;
  })();

  partSetsInFlight.set(cacheKey, request);
  try {
    return await request;
  } finally {
    if (partSetsInFlight.get(cacheKey) === request) {
      partSetsInFlight.delete(cacheKey);
    }
  }
};

const fieldsToSend = [
  { field: "color_id", objetcField: "color_id" },
  { field: "color_name", objetcField: "color_name" },
  { field: "part_img_url", objetcField: "part_img_url" },
  { field: "part_ids", objetcField: "elements" },
];

export const PartsController = {
  async getPartColors(part_num, page, page_size, color_id) {
    const pageSize = page_size || 100;

    // Si se especifica color_id, obtener de caché completo y filtrar
    if (color_id !== null && color_id !== undefined) {
      const allColors = await getCachedPartColors(part_num);

      const foundColor = allColors.find(
        (c) => c.color_id === parseInt(color_id),
      );

      if (!foundColor) {
        return {
          count: 0,
          results: [],
        };
      }

      const enrichedResults = await this._enrichColorResults([foundColor]);

      return {
        count: 1,
        results: enrichedResults,
      };
    }

    // Sin color_id: usar paginación normal (más rápido para primera página)
    const { data: colorsData } = await axios.get(
      `${URL}/parts/${part_num}/colors`,
      {
        params: { page: page || 1, page_size: pageSize },
        headers: {
          Authorization: `key ${KEY}`,
        },
      },
    );

    const allResults = colorsData.results || [];
    const enrichedResults = await this._enrichColorResults(allResults);

    return {
      ...colorsData,
      results: enrichedResults,
    };
  },

  async _enrichColorResults(colorResults) {
    const colorIds = colorResults.map((color) => color.color_id);

    const colorMap = new Map();

    // Obtener información completa de cada color desde ColorsController
    // con hasta 10 requests simultáneamente para mejor rendimiento
    const batchSize = 10;
    const batches = [];

    for (let i = 0; i < colorIds.length; i += batchSize) {
      const batch = colorIds.slice(i, i + batchSize);
      batches.push(
        Promise.all(
          batch.map((id) =>
            ColorsController.getColor(id)
              .then((colorData) => ({ id, data: colorData, error: null }))
              .catch((error) => ({ id, data: null, error })),
          ),
        ),
      );
    }

    const results = await Promise.all(batches);

    results.flat().forEach(({ id, data }) => {
      if (data) {
        colorMap.set(id, data);
      }
    });

    // Mapear campos usando fieldsToSend y agregar color_rgb
    return colorResults.map((result) => {
      const colorData = colorMap.get(result.color_id);
      const mappedData = new Object();

      fieldsToSend.forEach((field) => {
        mappedData[field.field] = result[field.objetcField];
      });

      return {
        ...mappedData,
        color_rgb: colorData?.rgb || null,
      };
    });
  },

  async getPartSets(part_num, color_id, page, page_size, theme_id, set_num) {
    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const pageSize = Math.max(parseInt(page_size, 10) || 1000, 1);

    const themeFilter = parseInt(theme_id, 10);
    const hasThemeFilter = !Number.isNaN(themeFilter);
    const setFilter = String(set_num ?? "")
      .trim()
      .toLowerCase();
    const hasSetFilter = setFilter !== "";

    if (hasThemeFilter || hasSetFilter) {
      const allSets = await getCachedPartSets(part_num, color_id);

      // Si vienen ambos filtros, el set debe cumplir los dos
      const foundSets = allSets.filter(
        (set) =>
          (!hasThemeFilter || set.theme_id === themeFilter) &&
          (!hasSetFilter || set.set_num.toLowerCase().includes(setFilter)),
      ).map((set) => ({
        ...set,
        set_num: normalizeSet(set.set_num)
      }));

      if (foundSets.length === 0) {
        return {
          count: 0,
          results: [],
        };
      }

      const start = (pageNumber - 1) * pageSize;
      const pageResults = foundSets.slice(start, start + pageSize);
      const enrichedResults = await this._enrichThemeResults(pageResults);

      return {
        count: foundSets.length,
        results: enrichedResults,
      };
    }

    const { data: setData } = await axios.get(
      `${URL}/parts/${part_num}/colors/${color_id}/sets`,
      {
        params: { page, page_size: pageSize },
        headers: {
          Authorization: `key ${KEY}`,
        },
      },
    );

    const allResults = setData.results || [];
    const enrichedResults = await this._enrichThemeResults(allResults);

    return {
      ...setData,
      results: enrichedResults,
    };
  },

  async _enrichThemeResults(setResults) {
    const themeIds = [...new Set(setResults.map((set) => set.theme_id))];

    const themeMap = new Map();

    const results = await Promise.all(
      themeIds.map((id) =>
        ThemesController.getTheme(id)
          .then((themeData) => ({ id, data: themeData, error: null }))
          .catch((error) => ({ id, data: null, error })),
      ),
    );

    results.forEach(({ id, data }) => {
      if (data) {
        themeMap.set(id, data);
      }
    });

    // Mapear campos usando fieldsToSend y agregar color_rgb
    return setResults.map((result) => {
      const themeData = themeMap.get(result.theme_id);

      return {
        ...result,
        theme_name: themeData.name,
      };
    });
  },
};
