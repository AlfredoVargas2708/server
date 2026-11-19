import axios from "axios";
import CacheManager from "../utils/cacheManager.js";

const URL = process.env.REBRICKABLE_API_URL || "";
const KEY = process.env.REBRICKABLE_API_KEY || "";
const categoriesCache = new CacheManager(5 * 60 * 1000);
const categoryCache = new CacheManager(5 * 60 * 1000);

export const PartCategoriesController = {
  async getPartCategories() {
    return categoriesCache.getOrSet("all", async () => {
      const { data } = await axios.get(`${URL}/part_categories`, {
        headers: {
          Authorization: `key ${KEY}`,
        },
      });
      return data;
    });
  },

  async getPartCategory(part_cat_id) {
    return categoryCache.getOrSet(part_cat_id, async () => {
      const { data } = await axios.get(`${URL}/part_categories/${part_cat_id}`, {
        headers: {
          Authorization: `key ${KEY}`,
        },
      });
      return data;
    });
  },
};
