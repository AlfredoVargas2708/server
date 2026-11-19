import { Router } from "express";
import { ColorsController } from "../controllers/colors.controller.js";

const colorsRouter = Router();

colorsRouter.get("/", async (req, res) => {
  try {
    const colors = await ColorsController.getColors();

    return res.status(200).json(colors);
  } catch (error) {
    console.error("Error al obtener los colores:", error);
    return res.status(500).json({ error: "Error en GET /colors" });
  }
});

colorsRouter.get("/color", async (req, res) => {
  try {
    const { color_id } = req.query;

    if (!color_id)
      return res.status(400).json({ error: "Falta el parámetro de color_id" });

    const color = await ColorsController.getColor(color_id);

    return res.status(200).json(color);
  } catch (error) {
    console.error("Error al obtener los colores:", error);
    return res.status(500).json({ error: "Error en GET /colors/color" });
  }
});

export default colorsRouter;
