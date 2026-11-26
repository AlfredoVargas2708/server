import { Router } from "express";
import { ElementsController } from "../controllers/elements.controller.js";

const elementsRouter = Router();

elementsRouter.get("/element", async (req, res) => {
  try {
    const { element_id } = req.query;

    if (!element_id)
      return res
        .status(400)
        .json({ error: "Falta el parámetro de element_id" });

    const element = await ElementsController.getElement(element_id);

    return res.status(200).json(element);
  } catch (error) {
    console.error("Error al obtener la información del elemento:", error);
    return res.status(500).json({ error: "Error Interno Del Servidor" });
  }
});

elementsRouter.put("/create", async (req, res) => {
  try {
    const body = req.body;

    if (!body)
      return res
        .status(400)
        .json({ error: "Falta el elemento completo para crear fila" });

    const element = await ElementsController.createElement(body);

    return res.status(201).json(element);
  } catch (error) {
    console.error("Error al crear nuevo elemento:", error);
    return res.status(500).json({ error: "Error Interno Del Servidor" });
  }
});

export default elementsRouter;
