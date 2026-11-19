import assert from "node:assert/strict";
import { test } from "node:test";
import axios from "axios";
import CacheManager from "../utils/cacheManager.js";

test("CacheManager respeta el TTL y admite valores nulos", async (t) => {
  let now = 1000;
  t.mock.method(Date, "now", () => now);
  const cache = new CacheManager(100);
  let calls = 0;
  const load = async () => {
    calls++;
    return null;
  };

  assert.equal(await cache.getOrSet(1, load), null);
  assert.equal(await cache.getOrSet(1, load), null);
  assert.equal(cache.has(1), true);
  assert.equal(calls, 1);
  now += 100;
  assert.equal(cache.has(1), false);
  assert.equal(await cache.getOrSet(1, load), null);
  assert.equal(calls, 2);

  await assert.rejects(cache.getOrSet("error", async () => {
    throw new Error("API error");
  }), /API error/);
  assert.equal(cache.has("error"), false);
});

test("los controladores comparten caché sin mezclar categorías y piezas", async (t) => {
  let now = 1000;
  t.mock.method(Date, "now", () => now);
  const originalUrl = process.env.REBRICKABLE_API_URL;
  t.after(() => {
    if (originalUrl === undefined) delete process.env.REBRICKABLE_API_URL;
    else process.env.REBRICKABLE_API_URL = originalUrl;
  });
  process.env.REBRICKABLE_API_URL = "https://example.test";
  const calls = new Map();
  const adapter = async (config) => {
    const url = config.url;
    calls.set(url, (calls.get(url) || 0) + 1);
    let data;
    if (url === "https://example.test/part_categories") {
      data = { results: [{ id: "fig-100", name: "Category" }] };
    } else if (url === "https://example.test/part_categories/fig-100") {
      data = { id: "fig-100", name: "Category" };
    } else if (url === "https://example.test/elements/1") {
      data = {
        element_id: 1,
        part: { part_cat_id: "fig-100", name: "Part" },
        color: { id: 2, name: "Red", rgb: "ff0000" },
      };
    } else if (url === "https://example.test/sets/123-1/minifigs") {
      data = { results: [{ set_num: "fig-100" }] };
    } else if (url === "https://example.test/minifigs/fig-100/parts") {
      data = { results: [{ element_id: 1, part: { part_cat_id: "fig-100" }, color: {} }] };
    } else if (url === "https://example.test/sets/123-1/parts") {
      data = { results: [{ element_id: 1, part: { part_cat_id: "fig-100" }, color: {} }] };
    } else if (url === "https://example.test/colors/2") {
      data = { id: 2, rgb: "ff0000" };
    } else if (url === "/themes/") {
      data = {
        results: [
          { id: 1, name: "Parent", parent_id: null },
          { id: 2, name: "Child", parent_id: 1 },
        ],
        next: null,
      };
    } else {
      throw new Error(`URL inesperada: ${url}`);
    }
    return { data, status: 200, statusText: "OK", headers: {}, config };
  };
  const originalAdapter = axios.defaults.adapter;
  axios.defaults.adapter = adapter;
  t.after(() => { axios.defaults.adapter = originalAdapter; });
  const { ElementsController } = await import("../controllers/elements.controller.js");
  const { PartCategoriesController } = await import("../controllers/part_categories.controller.js");
  const { SetsController } = await import("../controllers/sets.controller.js");
  const { ColorsController } = await import("../controllers/colors.controller.js");
  const { ThemesController } = await import("../controllers/themes.controller.js");

  const [themes1, themes2] = await Promise.all([
    ThemesController.getThemes(),
    ThemesController.getThemes(),
  ]);
  assert.deepEqual(themes1, themes2);
  assert.equal((await ThemesController.getTheme(2)).name, "Parent");
  assert.equal(calls.get("/themes/"), 1);
  await PartCategoriesController.getPartCategories();
  await PartCategoriesController.getPartCategories();
  assert.equal(calls.get("https://example.test/part_categories"), 1);
  assert.equal((await ElementsController.getElement(1)).part_cat_name, "Category");
  await ElementsController.getElement(1);
  assert.equal(calls.get("https://example.test/elements/1"), 1);
  await SetsController.getSetMinifigs("123");
  await SetsController.getSetMinifigs("123");
  assert.equal(calls.get("https://example.test/minifigs/fig-100/parts"), 1);
  assert.equal((await SetsController.getSetParts("123")).results[0].part_cat_name, "Category");
  assert.equal(calls.get("https://example.test/part_categories/fig-100"), 1);

  await ColorsController.getColor(2);
  now += 5 * 60 * 1000;
  await ElementsController.getElement(1);
  await PartCategoriesController.getPartCategories();
  await SetsController.getSetMinifigs("123");
  await ColorsController.getColor(2);
  assert.equal(calls.get("https://example.test/elements/1"), 2);
  assert.equal(calls.get("https://example.test/part_categories"), 2);
  assert.equal(calls.get("https://example.test/part_categories/fig-100"), 2);
  assert.equal(calls.get("https://example.test/minifigs/fig-100/parts"), 2);
  assert.equal(calls.get("https://example.test/colors/2"), 1);
  now += 5 * 60 * 1000;
  await ColorsController.getColor(2);
  assert.equal(calls.get("https://example.test/colors/2"), 2);
  now += 50 * 60 * 1000;
  await ThemesController.getThemes();
  assert.equal(calls.get("/themes/"), 2);
});

test("sets de piezas conservan la deduplicación y recuperan errores", async (t) => {
  const calls = new Map();
  let fail = true;
  const originalUrl = process.env.REBRICKABLE_API_URL;
  process.env.REBRICKABLE_API_URL = "https://example.test";
  t.after(() => {
    if (originalUrl === undefined) delete process.env.REBRICKABLE_API_URL;
    else process.env.REBRICKABLE_API_URL = originalUrl;
  });
  const adapter = async (config) => {
    const url = config.url;
    calls.set(url, (calls.get(url) || 0) + 1);
    await new Promise((resolve) => setTimeout(resolve, 5));
    let data;
    if (url === "https://example.test/parts/p/colors/2/sets") {
      if (fail) throw new Error("API error");
      data = { results: [{ set_num: "123-1", theme_id: 1 }], next: null };
    } else if (url === "https://example.test/parts/p/colors") {
      data = { results: [], next: null };
    } else {
      throw new Error(`URL inesperada: ${url}`);
    }
    return { data, status: 200, statusText: "OK", headers: {}, config };
  };
  const { ThemesController } = await import("../controllers/themes.controller.js");
  const { PartsController } = await import("../controllers/parts.controller.js");
  const originalAdapter = axios.defaults.adapter;
  axios.defaults.adapter = adapter;
  t.after(() => { axios.defaults.adapter = originalAdapter; });
  await assert.rejects(PartsController.getPartSets("p", 2, 1, 10, 1), /API error/);
  fail = false;
  // Evitar la consulta de temas para concentrar la prueba en la caché de sets.
  t.mock.method(ThemesController, "getTheme", async () => ({ name: "Theme" }));
  const [first, second] = await Promise.all([
    PartsController.getPartSets("p", 2, 1, 10, 1),
    PartsController.getPartSets("p", 2, 1, 10, 1),
  ]);
  assert.deepEqual(first, second);
  assert.equal(first.results[0].theme_name, "Theme");
  assert.equal(calls.get("https://example.test/parts/p/colors/2/sets"), 2);
  await PartsController.getPartSets("p", 2, 1, 10, 1);
  assert.equal(calls.get("https://example.test/parts/p/colors/2/sets"), 2);
  assert.deepEqual(await PartsController.getPartColors("p", 1, 10, 2), {
    count: 0,
    results: [],
  });
  await PartsController.getPartColors("p", 1, 10, 2);
  assert.equal(calls.get("https://example.test/parts/p/colors"), 1);
});
