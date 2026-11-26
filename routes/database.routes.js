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

    // Parsear y validar filtros
    let filters = {};
    if (req.query.filter) {
      try {
        filters = JSON.parse(req.query.filter);
        // Asegurar que filters es un objeto válido
        if (
          typeof filters !== "object" ||
          filters === null ||
          Array.isArray(filters)
        ) {
          filters = {};
        }
      } catch (parseError) {
        filters = {};
      }
    }

    const operations = await DatabaseController.getOperations(
      sortField,
      validOrder,
      Math.max(1, Number(page) || 1),
      Math.max(1, Number(rows) || 5),
      filters,
    );

    return res.status(200).json(operations);
  } catch (error) {
    console.error("Error al obtener las operaciones:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

databaseRouter.put("/status/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;

    await DatabaseController.editStatusOperation(id, body);
  } catch (error) {
    console.error("Error al editar la operación:", error);
    return res.status(500).json({ error: "Error Interno Del Servidor" });
  }
});

databaseRouter.put("/edit-operation/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { field, value } = req.body;

    if (!field || !value)
      return res
        .status(400)
        .json({ error: "Faltan los campos de field y/o value" });

    await DatabaseController.editOperation(id, field, value);

    return res.status(201).json({ message: "Operación editada correctamente" });
  } catch (error) {
    console.error("Error al editar la operación:", error);
    return res.status(500).json({ error: "Error Interno Del Servidor" });
  }
});

export default databaseRouter;
