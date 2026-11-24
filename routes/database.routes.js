import { Router } from "express";
import { sequelize } from "../database/models.js";
import { DatabaseController } from "../controllers/database.controller.js";

const databaseRouter = Router();

databaseRouter.get("/test", async (req, res) => {
  try {
    await sequelize.authenticate();
    return res
      .status(200)
      .json({ message: "Connection has been established successfully." });
  } catch (error) {
    console.error("Unable to connect to the database:", error);
  }
});

databaseRouter.post("/create", async (req, res) => {
  try {
    const body = req.body;

    await DatabaseController.createOperacion(body);

    return res.status(200).json({ message: "Pedido Creado Correctamente" });
  } catch (error) {
    console.error("Error al crear una nueva operación:", error);
    return res.status(500).json({ error: "Error Interno Servidor" });
  }
});

databaseRouter.get("/", async (req, res) => {
  try {
    const {
      sortOrder = "ASC",
      sortField = "operation_id",
      page = 1,
      rows = 5,
    } = req.query;

    const validOrder = ["ASC", "DESC"].includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "ASC";

    const filters = req.query.filter ? JSON.parse(req.query.filter) : {};

    const operations = await DatabaseController.getOperations(
      sortField,
      validOrder,
      Number(page),
      Number(rows),
      filters,
    );

    return res.status(200).json(operations);
  } catch (error) {
    console.error("Error al obtener las operaciones:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

export default databaseRouter;
