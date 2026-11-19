import { Router } from "express";
import { PartsController } from "../controllers/parts.controller.js";

const partsRouter = Router();

partsRouter.get("/colors", async (req, res) => {
  try {
    const { part_num, page = 1, page_size = 10, color_id = null } = req.query;

    if (!part_num)
      return res.status(400).json({ error: "Falta el campo de part_num" });

    const partColors = await PartsController.getPartColors(
      part_num,
      page,
      page_size,
      color_id,
    );

    return res.status(200).json(partColors);
  } catch (error) {
    console.error("Error al obtener los colores de la pieza:", error);
    return res.status(500).json({ error: "Error Interno Del Servidor" });
  }
});

partsRouter.get("/sets", async (req, res) => {
  try {
    const {
      part_num,
      color_id,
      page = 1,
      page_size = 5,
      theme_id,
      set_num,
    } = req.query;

    if (!part_num || !color_id)
      return res
        .status(400)
        .json({ error: "Faltan los campos de part_num y/o color_id" });

    const partSets = await PartsController.getPartSets(
      part_num,
      color_id,
      page,
      page_size,
      theme_id,
      set_num,
    );

    return res.status(200).json(partSets);
  } catch (error) {
    console.error("Error al obtener los colores de la pieza:", error);
    return res.status(500).json({ error: "Error Interno Del Servidor" });
  }
});

export default partsRouter;
