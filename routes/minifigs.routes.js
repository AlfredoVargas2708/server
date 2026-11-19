import { Router } from "express";
import { MinifigsController } from "../controllers/minifigs.controller.js";

const minifigsRouter = Router();

minifigsRouter.get("/parts", async (req, res) => {
  try {
    const { set_num, page = 1, page_size = 5 } = req.query;

    if (!set_num)
      return res.status(400).json({ error: "Falta el campo de set_num" });

    const parts = await MinifigsController.getMinifigParts(
      set_num,
      page,
      page_size,
    );

    return res.status(200).json(parts);
  } catch (error) {
    console.error("Error al obtener las piezas de la minifigura:", error);
    return res.status(500).json({ error: "Error Interno Del Servidor" });
  }
});

export default minifigsRouter;
