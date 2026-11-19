import { Router } from "express";
import { PartCategoriesController } from "../controllers/part_categories.controller.js";

const partCategoriesRouter = Router();

partCategoriesRouter.get("/", async (_, res) => {
  try {
    const categories = await PartCategoriesController.getPartCategories();

    return res.status(200).json(categories);
  } catch (error) {
    console.error("Error al obtener las categorias de las partes:", error);
    return res.status(500).json({ error: error.detail });
  }
});

partCategoriesRouter.get("/category", async (req, res) => {
  try {
    const { part_cat_id } = req.query;

    if (!part_cat_id) return res.status(400).json({ error: "Falta el campo de part_cat_id" });

    const category = await PartCategoriesController.getPartCategory(part_cat_id);

    return res.status(200).json(category);
  } catch (error) {
    console.error("Error al obtener la categorias de la pieza:", error);
    return res.status(500).json({ error: error.detail });
  }
});

export default partCategoriesRouter;
