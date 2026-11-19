import assert from "node:assert/strict";
import { test } from "node:test";
import axios from "axios";

test("sets reutiliza respuestas por operación y página durante cinco minutos", async (t) => {
  let now = 1000;
  t.mock.method(Date, "now", () => now);
  const oldUrl = process.env.REBRICKABLE_API_URL;
  const oldBrickUrl = process.env.BRICKSET_API_URL;
  process.env.REBRICKABLE_API_URL = "https://example.test";
  process.env.BRICKSET_API_URL = "https://brickset.test";
  const originalAdapter = axios.defaults.adapter;
  t.after(() => {
    if (oldUrl === undefined) delete process.env.REBRICKABLE_API_URL;
    else process.env.REBRICKABLE_API_URL = oldUrl;
    if (oldBrickUrl === undefined) delete process.env.BRICKSET_API_URL;
    else process.env.BRICKSET_API_URL = oldBrickUrl;
    axios.defaults.adapter = originalAdapter;
  });

  const calls = new Map();
  let failSet = true;
  axios.defaults.adapter = async (config) => {
    const key = JSON.stringify([config.url, config.params]);
    calls.set(key, (calls.get(key) || 0) + 1);
    let data;
    if (config.url === "https://example.test/sets/123-1") {
      data = { set_num: "123-1", theme_id: 1, num_parts: 42 };
    } else if (config.url === "https://example.test/sets/error-1") {
      if (failSet) {
        failSet = false;
        throw new Error("API error");
      }
      data = { set_num: "error-1", theme_id: 1, num_parts: 1 };
    } else if (config.url === "https://example.test/sets/123-1/parts") {
      data = {
        page: config.params.page,
        results: [{ part: { part_cat_id: 7 }, color: {} }],
      };
    } else if (config.url === "https://example.test/sets/123-1/minifigs") {
      data = { page: config.params.page, results: [{ set_num: "fig-1" }] };
    } else if (config.url === "https://brickset.test") {
      data = { instructions: [{ URL: "https://product.bi.core.pdf/1.pdf", description: "V29" }] };
    } else {
      throw new Error(`URL inesperada: ${config.url}`);
    }
    return { data, status: 200, statusText: "OK", headers: {}, config };
  };
  const { SetsController } = await import("../controllers/sets.controller.js");
  const { ThemesController } = await import("../controllers/themes.controller.js");
  const { PartCategoriesController } = await import("../controllers/part_categories.controller.js");
  const { MinifigsController } = await import("../controllers/minifigs.controller.js");
  t.mock.method(ThemesController, "getTheme", async () => ({ name: "Theme" }));
  let failCategory = true;
  t.mock.method(PartCategoriesController, "getPartCategory", async () => {
    if (failCategory) {
      failCategory = false;
      throw new Error("Category error");
    }
    return { name: "Category" };
  });
  t.mock.method(MinifigsController, "getMinifigParts", async () => ({ results: [] }));

  const count = (url, params) => calls.get(JSON.stringify([url, params])) || 0;
  const setUrl = "https://example.test/sets/123-1";
  const partsUrl = `${setUrl}/parts`;
  const minifigsUrl = `${setUrl}/minifigs`;

  assert.equal((await SetsController.getSet("123")).num_pieces, 42);
  assert.equal((await SetsController.getSet("123-1")).theme_name, "Theme");
  assert.equal(count(setUrl), 1);
  await assert.rejects(SetsController.getSet("error"), /API error/);
  assert.equal((await SetsController.getSet("error")).num_pieces, 1);
  assert.equal(count("https://example.test/sets/error-1"), 2);

  assert.equal((await SetsController.getSetParts("123", 1, 10)).results[0].part_cat_name, undefined);
  assert.equal((await SetsController.getSetParts("123", 1, 10)).results[0].part_cat_name, "Category");
  assert.equal((await SetsController.getSetParts("123", 2, 10)).page, 2);
  assert.equal((await SetsController.getSetParts("123", 1, 20)).page, 1);
  assert.equal(count(partsUrl, { page: 1, page_size: 10 }), 1);
  assert.equal(count(partsUrl, { page: 2, page_size: 10 }), 1);
  assert.equal(count(partsUrl, { page: 1, page_size: 20 }), 1);

  assert.deepEqual((await SetsController.getSetMinifigs("123", 1, 10)).results[0].parts, { results: [] });
  await SetsController.getSetMinifigs("123", 1, 10);
  await SetsController.getSetMinifigs("123", 2, 10);
  assert.equal(count(minifigsUrl, { page: 1, page_size: 10 }), 1);
  assert.equal(count(minifigsUrl, { page: 2, page_size: 10 }), 1);

  assert.equal((await SetsController.getInstructions("123")).length, 1);
  await SetsController.getInstructions("123");
  assert.equal(count("https://brickset.test", { apiKey: process.env.BRICKSET_API_KEY || "", setNumber: "123" }), 1);

  now += 5 * 60 * 1000;
  await SetsController.getSet("123");
  await SetsController.getSetParts("123", 1, 10);
  await SetsController.getSetMinifigs("123", 1, 10);
  await SetsController.getInstructions("123");
  assert.equal(count(setUrl), 2);
  assert.equal(count(partsUrl, { page: 1, page_size: 10 }), 2);
  assert.equal(count(minifigsUrl, { page: 1, page_size: 10 }), 2);
  assert.equal(count("https://brickset.test", { apiKey: process.env.BRICKSET_API_KEY || "", setNumber: "123" }), 2);
});
