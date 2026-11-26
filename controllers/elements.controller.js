import axios from "axios";
import { getPropByString } from "../utils/getNestesValue.js";
import { PartCategoriesController } from "./part_categories.controller.js";
import CacheManager from "../utils/cacheManager.js";
import {
  Color,
  Element,
  Part,
  PartCategory,
  sequelize,
} from "../database/models.js";
import { ensure, splitBody } from "../utils/database.utils.js";

const URL = process.env.REBRICKABLE_API_URL || "";
const KEY = process.env.REBRICKABLE_API_KEY || "";
const elementCache = new CacheManager(5 * 60 * 1000);

const fieldsToSend = [
  { field: "element_img_url", objetcField: "element_img_url" },
  { field: "element_id", objetcField: "element_id" },
  { field: "element_name", objetcField: "part.name" },
  { field: "part_num", objetcField: "part.part_num" },
  { field: "color_name", objetcField: "color.name" },
  { field: "color_rgb", objetcField: "color.rgb" },
  { field: "color_id", objetcField: "color.id" },
  { field: "part_cat_id", objetcField: "part.part_cat_id" },
  { field: "part_url", objetcField: "part.part_url" },
];

export const ElementsController = {
  async getElement(element_id) {
    return elementCache.getOrSet(element_id, async () => {
      const { data: elementData } = await axios.get(
        `${URL}/elements/${element_id}`,
        {
          headers: {
            Authorization: `key ${KEY}`,
          },
        },
      );

      const data = new Object();

      fieldsToSend.forEach((field) => {
        data[field.field] = getPropByString(elementData, field.objetcField);
      });

      const partCat = await PartCategoriesController.getPartCategory(
        data["part_cat_id"],
      );

      data["part_cat_name"] = partCat.name;

      return data;
    });
  },

  async createElement(newElement) {
    const { element, color, part, partCat } = splitBody(newElement);

    return sequelize.transaction(async (t) => {
      await ensure(PartCategory, partCat, "part_cat_id", t);
      await ensure(Part, part, "part_num", t);
      await ensure(Color, color, "color_id", t);
      await ensure(Element, element, "element_id", t);
    });
  },
};
