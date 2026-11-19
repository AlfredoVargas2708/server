import { Router } from "express";
import colorsRouter from "./colors.routes.js";
import elementsRouter from "./elements.routes.js";
import partCategoriesRouter from "./part_categories.routes.js";
import partsRouter from "./parts.routes.js";
import setsRouter from "./sets.routes.js";
import themesRouter from "./themes.routes.js";
import minifigsRouter from "./minifigs.routes.js";

const api = Router();

api.use("/colors", colorsRouter);
api.use("/elements", elementsRouter);
api.use("/part-categories", partCategoriesRouter);
api.use("/parts", partsRouter);
api.use("/sets", setsRouter);
api.use("/themes", themesRouter);
api.use("/minifigs", minifigsRouter);

export default api;
