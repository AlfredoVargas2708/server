import axios from "axios";
import { ThemesController } from "./themes.controller.js";
import { PartCategoriesController } from "./part_categories.controller.js";
import { getPropByString, normalizeSet } from "../utils/getNestesValue.js";
import { MinifigsController } from "./minifigs.controller.js";
import CacheManager from "../utils/cacheManager.js";
import { LegoSet, sequelize, Theme } from "../database/models.js";
import { ensure, splitBody } from "../utils/database.utils.js";

const URL = process.env.REBRICKABLE_API_URL || "";
const KEY = process.env.REBRICKABLE_API_KEY || "";

const BRICK_URL = process.env.BRICKSET_API_URL || "";
const BRICK_KEY = process.env.BRICKSET_API_KEY || "";

const setsCache = new CacheManager(5 * 60 * 1000);
// Caché de piezas de minifiguras (5 minutos)
const partsCache = new CacheManager(5 * 60 * 1000);
const setColorsCache = new CacheManager(5 * 60 * 1000);

const getCachedParts = async (id) => {
  return partsCache.getOrSet(id, () => MinifigsController.getMinifigParts(id));
};

const getCachedSetColors = async (set_num) => {
  const cached = setColorsCache.get(set_num);
  if (cached !== null) {
    return cached;
  }

  let allResults = [];
  let currentPage = 1;
  const pageSize = 100;
  let hasMore = true;

  while (hasMore) {
    try {
      const { data: partsData } = await axios.get(
        `${URL}/sets/${set_num}/parts`,
        {
          params: { page: currentPage, page_size: pageSize },
          headers: {
            Authorization: `key ${KEY}`,
          },
        },
      );

      if (partsData.results && partsData.results.length > 0) {
        const colors = partsData.results.map((result) => result.color);
        allResults.push(...colors);
        currentPage++;

        // Esperar solo 50ms entre requests
        await new Promise((resolve) => setTimeout(resolve, 50));

        hasMore = !!partsData.next;
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

  // Eliminar duplicados manteniendo solo colores únicos
  const uniqueColors = [
    ...new Set(allResults.map((color) => JSON.stringify(color))),
  ]
    .map((color) => JSON.parse(color))
    .sort((a, b) => a.id - b.id);

  setColorsCache.set(set_num, uniqueColors);
  return uniqueColors;
};

const fieldsToSend = [
  { field: "element_id", objetcField: "element_id" },
  { field: "element_name", objetcField: "part.name" },
  { field: "part_num", objetcField: "part.part_num" },
  { field: "element_img_url", objetcField: "part.part_img_url" },
  { field: "color_name", objetcField: "color.name" },
  { field: "color_rgb", objetcField: "color.rgb" },
  { field: "color_id", objetcField: "color.id" },
  { field: "part_cat_id", objetcField: "part.part_cat_id" },
];

/**
 * Filtra y limpia el array de instrucciones devuelto por getInstructions2 de Brickset.
 * @param {Array<{URL: string, description: string}>} instructions
 * @returns {Array<{URL: string, description: string}>}
 */
function filtrarInstruccionesLego(instructions) {
  if (!Array.isArray(instructions)) return [];

  // 1. Filtrar solo los PDFs principales de construcción (descarta Info Booklets y extras)
  let validas = instructions.filter((item) => {
    const desc = item.description.toUpperCase();
    const url = item.URL.toLowerCase();

    const esManualPrincipal = url.includes("product.bi.core.pdf");
    const noEsFolletoExtra =
      !desc.includes("INFO_BOOKLET") && !desc.includes("ADDITIONAL");

    return esManualPrincipal && noEsFolletoExtra;
  });

  // 2. Filtrar versiones por región/idioma:
  // Priorizamos V29 (estándar principal) o V29/39 (combinado).
  // Si existen versiones V29, descartamos las que sean únicamente V39, V142, etc.
  const tieneV29 = validas.some((item) => /V29/i.test(item.description));
  if (tieneV29) {
    validas = validas.filter((item) => /V29/i.test(item.description));
  }

  // 3. Eliminar duplicados exactos o revisiones viejas del mismo libro/tomo
  const unicas = new Map();

  const getTomo = (item) => {
    const matches = [...item.description.matchAll(/(\d+)\/(\d+)/g)];
    const last = matches.at(-1);
    return last
      ? { actual: parseInt(last[1], 10), total: parseInt(last[2], 10) }
      : null;
  };

  validas.forEach((item) => {
    // Detecta si el manual está dividido en tomos (ej. "1/3", "2/3")
    const tomo = getTomo(item);
    const claveTomo = tomo ? `tomo_${tomo.actual}/${tomo.total}` : "tomo_unico";

    // Si ya guardamos ese tomo, lo reemplazamos solo si el nuevo tiene un ID de PDF mayor (revisión más nueva)
    if (!unicas.has(claveTomo)) {
      unicas.set(claveTomo, item);
    } else {
      const actualId = parseInt(
        unicas.get(claveTomo).URL.match(/(\d+)\.pdf$/)?.[1] || 0,
        10,
      );
      const nuevoId = parseInt(item.URL.match(/(\d+)\.pdf$/)?.[1] || 0, 10);
      if (nuevoId > actualId) {
        unicas.set(claveTomo, item);
      }
    }
  });

  // 4. Ordenar los tomos en secuencia (1/3, 2/3, 3/3) si aplica
  return Array.from(unicas.values()).sort(
    (a, b) => (getTomo(a)?.actual ?? 0) - (getTomo(b)?.actual ?? 0),
  );
}

export const SetsController = {
  async getSet(set_num) {
    const normalizedSet = normalizeSet(set_num);
    const setData = await setsCache.getOrSet(
      JSON.stringify(["set", normalizedSet]),
      async () => {
        const { data } = await axios.get(`${URL}/sets/${normalizedSet}`, {
          headers: {
            Authorization: `key ${KEY}`,
          },
        });
        return data;
      },
    );

    const theme = await ThemesController.getTheme(setData.theme_id);

    return {
      ...setData,
      set_num: normalizeSet(setData.set_num),
      theme_name: theme.name,
      num_pieces: setData.num_parts,
    };
  },

  async getSetParts(
    set_num,
    page,
    page_size,
    color_id,
    part_cat_id,
    element_id,
  ) {
    const normalizedSet = normalizeSet(set_num);
    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const pageSize = Math.max(parseInt(page_size, 10) || 100, 1);

    const colorFilter = parseInt(color_id, 10);
    const hasColorFilter = !Number.isNaN(colorFilter);
    const partCatFilter = parseInt(part_cat_id, 10);
    const hasPartCatFilter = !Number.isNaN(partCatFilter);
    const hasElementIdFilter = element_id !== null && element_id !== undefined;

    // Si se especifica color_id, obtener todas las partes y filtrar
    if (hasColorFilter || hasPartCatFilter || hasElementIdFilter) {
      let allResults = [];
      let currentPage = 1;
      let hasMore = true;

      while (hasMore) {
        try {
          const { data: partsData } = await axios.get(
            `${URL}/sets/${normalizedSet}/parts`,
            {
              params: { page: currentPage, page_size: 1000 },
              headers: {
                Authorization: `key ${KEY}`,
              },
            },
          );

          if (partsData.results && partsData.results.length > 0) {
            allResults.push(...partsData.results);
            currentPage++;

            await new Promise((resolve) => setTimeout(resolve, 50));

            hasMore = !!partsData.next;
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

      // Filtrar por color_id && part_cat_id
      const filteredParts = allResults.filter(
        (part) =>
          (!hasColorFilter || part.color.id === colorFilter) &&
          (!hasPartCatFilter || part.part.part_cat_id === partCatFilter) &&
          (!hasElementIdFilter ||
            (part.element_id && part.element_id.includes(element_id))),
      );

      if (filteredParts.length === 0) {
        return {
          count: 0,
          results: [],
        };
      }

      // Obtener información de categorías de partes
      const partCatIds = [
        ...new Set(filteredParts.map((part) => part.part.part_cat_id)),
      ];

      const partCatMap = new Map();

      const results = await Promise.allSettled(
        partCatIds.map((id) => PartCategoriesController.getPartCategory(id)),
      );

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          const partCatId = partCatIds[index];
          partCatMap.set(partCatId, result.value.name);
        }
      });

      // Aplicar paginación
      const start = (pageNumber - 1) * pageSize;
      const pageResults = filteredParts.slice(start, start + pageSize);

      const data = new Object();

      return {
        count: filteredParts.length,
        results: pageResults.map((result) => {
          fieldsToSend.forEach((field) => {
            data[field.field] = getPropByString(result, field.objetcField);
          });

          return {
            ...data,
            part_cat_name: partCatMap.get(data.part_cat_id),
          };
        }),
      };
    }

    // Sin color_id: usar paginación normal (más rápido para primera página)
    const setData = await setsCache.getOrSet(
      JSON.stringify(["parts", normalizedSet, page, page_size]),
      async () => {
        const { data } = await axios.get(`${URL}/sets/${normalizedSet}/parts`, {
          params: { page, page_size },
          headers: {
            Authorization: `key ${KEY}`,
          },
        });
        return data;
      },
    );

    const partCatIds = [
      ...new Set(setData.results.map((part) => part.part.part_cat_id)),
    ];

    const partCatMap = new Map();

    const results = await Promise.allSettled(
      partCatIds.map((id) => PartCategoriesController.getPartCategory(id)),
    );

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        const partCatId = partCatIds[index];
        partCatMap.set(partCatId, result.value.name);
      }
    });

    const data = new Object();

    return {
      ...setData,
      results: setData.results.map((result) => {
        fieldsToSend.forEach((field) => {
          data[field.field] = getPropByString(result, field.objetcField);
        });

        return {
          ...data,
          part_cat_name: partCatMap.get(data.part_cat_id),
        };
      }),
    };
  },

  async getSetPartQuantity(set_num, element_id) {
    const normalizedSet = normalizeSet(set_num);
    let allResults = [];
    let currentPage = 1;
    let hasMore = true;

    while (hasMore) {
      try {
        const { data: partsData } = await axios.get(
          `${URL}/sets/${normalizedSet}/parts?inc_minifig_parts=1`,
          {
            params: { page: currentPage, page_size: 1000 },
            headers: {
              Authorization: `key ${KEY}`,
            },
          },
        );

        if (partsData.results && partsData.results.length > 0) {
          allResults.push(...partsData.results);
          currentPage++;

          await new Promise((resolve) => setTimeout(resolve, 50));

          hasMore = !!partsData.next;
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

    const result = allResults.find(
      (result) => result.element_id === String(element_id),
    );

    if (!result) {
      return { quantityElement: 0 };
    }

    return { quantityElement: result.quantity };
  },

  async getSetColors(set_num) {
    const normalizedSet = normalizeSet(set_num);

    const colors = await getCachedSetColors(normalizedSet);

    return colors;
  },

  async getSetMinifigs(set_num, page, page_size) {
    const normalizedSet = normalizeSet(set_num);
    const minifigsData = await setsCache.getOrSet(
      JSON.stringify(["minifigs", normalizedSet, page, page_size]),
      async () => {
        const { data } = await axios.get(
          `${URL}/sets/${normalizedSet}/minifigs`,
          {
            params: { page, page_size },
            headers: {
              Authorization: `key ${KEY}`,
            },
          },
        );
        return data;
      },
    );

    const minifigNums = minifigsData.results.map((result) => result.set_num);

    const partsMap = new Map();

    const results = await Promise.allSettled(
      minifigNums.map((set_num) => getCachedParts(set_num)),
    );

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        const minifigNum = minifigNums[index];
        partsMap.set(minifigNum, result.value);
      }
    });

    return {
      ...minifigsData,
      results: minifigsData.results.map((result) => ({
        ...result,
        pieces: partsMap.get(result.set_num),
      })),
    };
  },

  async getInstructions(set_num) {
    const data = await setsCache.getOrSet(
      JSON.stringify(["instructions", set_num]),
      async () => {
        const { data } = await axios.get(`${BRICK_URL}`, {
          params: {
            apiKey: BRICK_KEY,
            setNumber: set_num,
          },
        });
        return data;
      },
    );

    return filtrarInstruccionesLego(data.instructions);
  },

  async createSet(newSet) {
    const { set, theme } = splitBody(newSet);

    return sequelize.transaction(async (t) => {
      await ensure(Theme, theme, "theme_id", t);
      await ensure(LegoSet, set, "set_num", t);
    });
  },
};
