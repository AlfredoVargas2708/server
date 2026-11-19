import { Router } from "express";
import { SetsController } from "../controllers/sets.controller.js";

const setsRouter = Router();

setsRouter.get("/set", async (req, res) => {
  try {
    const { set_num } = req.query;

    if (!set_num)
      return res.status(400).json({ error: "Falta el campo set_num" });

    const set = await SetsController.getSet(set_num);

    return res.status(200).json(set);
  } catch (error) {
    console.error("Error al obtener el set:", error);
    return res.status(500).json({ error: "Error Interno Del Servidor" });
  }
});

setsRouter.get("/parts", async (req, res) => {
  try {
    const {
      set_num,
      page = 1,
      page_size = 10,
      color_id,
      part_cat_id,
    } = req.query;

    if (!set_num)
      return res.status(400).json({ error: "Falta el campo set_num" });

    const partsSet = await SetsController.getSetParts(
      set_num,
      page,
      page_size,
      color_id,
      part_cat_id,
    );

    return res.status(200).json(partsSet);
  } catch (error) {
    console.error("Error al obtener las piezas del set:", error);
    return res.status(500).json({ error: "Error Interno Del Servidor" });
  }
});

setsRouter.get("/set-colors", async (req, res) => {
  try {
    const { set_num } = req.query;

    if (!set_num)
      return res.status(400).json({ error: "Falta el campo de set_num" });

    const colores = await SetsController.getSetColors(set_num);

    return res.status(200).json(colores);
  } catch (error) {
    console.error("Error al obtener los colores de las piezas del set:", error);
    return res.status(500).json({ error: "Error Interno Del Servidor" });
  }
});

setsRouter.get("/minifigs", async (req, res) => {
  try {
    const { set_num, page = 1, page_size = 10 } = req.query;

    if (!set_num)
      return res.status(400).json({ error: "Falta el campo set_num" });

    const minifigsSet = await SetsController.getSetMinifigs(
      set_num,
      page,
      page_size,
    );

    return res.status(200).json(minifigsSet);
  } catch (error) {
    console.error("Error al obtener las minifiguras del set:", error);
    return res.status(500).json({ error: "Error Interno Del Servidor" });
  }
});

setsRouter.get("/instructions", async (req, res) => {
  try {
    const { set_num } = req.query;

    if (!set_num)
      return res.status(400).json({ error: "Falta el campo de set_num" });

    const instructions = await SetsController.getInstructions(set_num);

    if (!instructions) {
      return res
        .status(404)
        .json({ error: "No se encontraron instrucciones para este set" });
    }

    return res.status(200).json(instructions);
  } catch (error) {
    console.error("Error al obtener las intrsucciones:", error);
    return res.status(500).json({ error: "Error Interno Del Servidor" });
  }
});

export default setsRouter;
