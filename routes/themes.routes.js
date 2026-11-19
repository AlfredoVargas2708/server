import { Router } from "express";
import { ThemesController } from "../controllers/themes.controller.js";

const themesRouter = Router();

themesRouter.get(`/`, async (req, res) => {
  try {
    const { page = 1, page_size = 10 } = req.query;

    const themes = await ThemesController.getThemes(page, page_size);

    return res.status(200).json(themes);
  } catch (error) {
    console.error("Error al obtener los temas:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

themesRouter.get(`/theme`, async (req, res) => {
  try {
    const { theme_id } = req.query;

    if (!theme_id)
      return res.status(400).json({ error: "Falta el campo de theme_id" });

    const theme = await ThemesController.getTheme(theme_id);

    return res.status(200).json(theme);
  } catch (error) {
    console.error("Error al obtener el tema:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

export default themesRouter;
