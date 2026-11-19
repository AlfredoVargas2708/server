import axios from "axios";
import { PartCategoriesController } from "./part_categories.controller.js";
import { getPropByString } from "../utils/getNestesValue.js";

const URL = process.env.REBRICKABLE_API_URL || "";
const KEY = process.env.REBRICKABLE_API_KEY || "";

const normalizeSet = (value) => {
  return value.includes("fig-") ? value : `fig-${value}`;
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

export const MinifigsController = {
  async getMinifig(set_num) {
    const { data } = await axios.get(
      `${URL}/minifigs/${normalizeSet(set_num)}`,
      {
        headers: {
          Authorization: `key ${KeyboardEvent}`,
        },
      },
    );

    return data;
  },

  async getMinifigParts(set_num, page, page_size) {
    const { data: partsData } = await axios.get(
      `${URL}/minifigs/${normalizeSet(set_num)}/parts`,
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
};
