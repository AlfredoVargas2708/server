import axios from "axios";
import { PartCategoriesController } from "./part_categories.controller.js";
import { getPropByString, normalizeMinifigSet, normalizeSet } from "../utils/getNestesValue.js";
import { SetsController } from "./sets.controller.js";

const URL = process.env.REBRICKABLE_API_URL || "";
const KEY = process.env.REBRICKABLE_API_KEY || "";

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

export const MinifigsController = {
  async getMinifig(set_num) {
    const { data } = await axios.get(
      `${URL}/minifigs/${normalizeMinifigSet(set_num)}`,
      {
        headers: {
          Authorization: `key ${KEY}`,
        },
      },
    );

    return { ...data, num_pieces: data.num_parts };
  },

  async getMinifigParts(set_num, page, page_size) {
    const { data: partsData } = await axios.get(
      `${URL}/minifigs/${normalizeMinifigSet(set_num)}/parts`,
      {
        params: { page, page_size },
        headers: {
          Authorization: `key ${KEY}`,
        },
      },
    );

    const partCatIds = [
      ...new Set(partsData.results.map((part) => part.part.part_cat_id)),
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
      ...partsData,
      results: partsData.results.map((result) => {
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

  async getMinifigSets(minifig_set_num, page, page_size) {
    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const pageSize = Math.max(parseInt(page_size, 10) || 1000, 1);

    const { data: setData } = await axios.get(
      `${URL}/minifigs/${normalizeMinifigSet(minifig_set_num)}/sets`,
      {
        params: { page: pageNumber, page_size: pageSize },
        headers: {
          Authorization: `key ${KEY}`,
        },
      },
    );

    const results = await this._getThemeSet(setData.results);

    return {
      count: setData.count,
      results,
    };
  },

  async _getThemeSet(setResults) {
    const setNumber = [...new Set(setResults.map((set) => set.set_num))];

    const setMap = new Map();

    const results = await Promise.all(
      setNumber.map((id) =>
        SetsController.getSet(id)
          .then((setData) => ({ id, data: setData, error: null }))
          .catch((error) => ({ id, data: null, error })),
      ),
    );

    results.forEach(({ id, data }) => {
      if (data) {
        setMap.set(id, data);
      }
    });

    // Mapear campos usando fieldsToSend y agregar color_rgb
    return setResults.map((result) => {
      const setData = setMap.get(result.set_num);

      return {
        ...result,
        set_num: normalizeSet(setData.set_num),
        theme_id: setData.theme_id,
        theme_name: setData.theme_name,
      };
    });
  },
};
