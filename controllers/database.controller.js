import { Op } from "sequelize";
import {
  Color,
  Element,
  LegoSet,
  Operation,
  Part,
  PartCategory,
  sequelize,
  Theme,
} from "../database/models.js";

const FIELDS = {
  operation: [
    "task",
    "set_num",
    "element_id",
    "pedido",
    "completo",
    "cantidad",
  ],
  set: [
    "set_num",
    "name",
    "year",
    "theme_id",
    "num_parts",
    "set_img_url",
    "set_url",
    "last_modified_dt",
  ],
  element: [
    "element_id",
    "part_num",
    "color_id",
    "element_name",
    "element_img_url",
  ],
  theme: ["theme_id", "theme_name"],
  color: ["color_id", "color_name", "color_rgb"],
  part: ["part_num", "part_cat_id", "part_url"],
  partCat: ["part_cat_id", "part_cat_name"],
};

// Toma solo las claves que realmente vienen en el body
const pick = (source, keys) =>
  Object.fromEntries(
    keys.filter((k) => source[k] !== undefined).map((k) => [k, source[k]]),
  );

const splitBody = (body) =>
  Object.fromEntries(
    Object.entries(FIELDS).map(([entity, keys]) => [entity, pick(body, keys)]),
  );

async function ensure(Model, data, pk, transaction) {
  // Solo ignorar si es undefined o null, permitir 0 como valor válido
  if (data[pk] === undefined || data[pk] === null) return;
  const { [pk]: id, ...defaults } = data;
  await Model.findOrCreate({ where: { [pk]: id }, defaults, transaction });
}

async function ensureElement(elementData, transaction) {
  // Solo ignorar si es undefined o null, permitir 0 como valor válido
  if (elementData.element_id === undefined || elementData.element_id === null)
    return;

  const { element_id, ...defaults } = elementData;

  if (defaults.color_id !== undefined && defaults.color_id !== null) {
    const colorExists = await Color.findByPk(defaults.color_id, {
      transaction,
    });
    if (!colorExists) {
      throw new Error(
        `Color with ID ${defaults.color_id} does not exist. Cannot create element ${element_id}.`,
      );
    }
  }

  await Element.findOrCreate({ where: { element_id }, defaults, transaction });
}

export const DatabaseController = {
  async createOperacion(body) {
    const { operation, set, element, theme, color, part, partCat } =
      splitBody(body);

    return sequelize.transaction(async (t) => {
      await ensure(Theme, theme, "theme_id", t);
      await ensure(PartCategory, partCat, "part_cat_id", t);
      await ensure(Part, part, "part_num", t);
      await ensure(Color, color, "color_id", t);
      await ensure(Element, element, "element_id", t);
      await ensure(LegoSet, set, "set_num", t);

      return Operation.create(operation, { transaction: t });
    });
  },

  async getOperations(field, order, page, rows, filters = {}) {
    // 1. Mapeo unificado: sirve tanto para ORDER como para WHERE
    const columnPathMap = {
      // Tabla principal (Operation)
      operation_id: ["operation_id"],
      task: ["task"],
      set_num: ["set_num"],
      element_id: ["element_id"],
      pedido: ["pedido"],
      completo: ["completo"],
      cantidad: ["cantidad"],
      created_at: ["created_at"],

      // LegoSet
      name: [{ model: LegoSet }, "name"],
      year: [{ model: LegoSet }, "year"],
      num_parts: [{ model: LegoSet }, "num_parts"],

      // Theme (dentro de LegoSet)
      theme_name: [{ model: LegoSet }, { model: Theme }, "theme_name"],

      // Element
      element_name: [{ model: Element }, "element_name"],
      element_img_url: [{ model: Element }, "element_img_url"],

      // Color (dentro de Element)
      color_name: [{ model: Element }, { model: Color }, "color_name"],
      color_rgb: [{ model: Element }, { model: Color }, "color_rgb"],

      // Part (dentro de Element)
      part_num: [{ model: Element }, { model: Part }, "part_num"],
      part_url: [{ model: Element }, { model: Part }, "part_url"],

      // PartCategory (dentro de Part)
      part_cat_name: [
        { model: Element },
        { model: Part },
        { model: PartCategory },
        "part_cat_name",
      ],
    };

    // Campos que NO son strings (para hacer búsqueda exacta en vez de LIKE)
    // Solo los campos INTEGER, SMALLINT y BOOLEAN de tus modelos
    const rangeFields = new Set(["num_parts", "cantidad"]);

    const exactMatchFields = new Set([
      "operation_id",
      "task",
      "cantidad",
      "year",
      "num_parts",
    ]);

    const booleanFields = new Set(["pedido", "completo"]);

    // 2. Validar ordenamiento
    const sortKey = columnPathMap[field] ? field : "operation_id";
    const sortOrder = order?.toUpperCase() === "DESC" ? "DESC" : "ASC";
    const orderClause = [...columnPathMap[sortKey], sortOrder];

    // 3. Construir dinámicamente el objeto WHERE
    const whereClause = {};

    for (const [filterKey, filterValue] of Object.entries(filters)) {
      if (
        !columnPathMap[filterKey] ||
        filterValue === "" ||
        filterValue == null
      ) {
        continue;
      }

      const pathArray = columnPathMap[filterKey];
      const sequelizeKey =
        pathArray.length === 1
          ? pathArray[0]
          : `$${pathArray
              .map((item) =>
                typeof item === "string" ? item : item.model.name,
              )
              .join(".")}$`;

      // ✅ CASO 1: Filtro por rango { min, max }
      if (
        rangeFields.has(filterKey) &&
        typeof filterValue === "object" &&
        !Array.isArray(filterValue)
      ) {
        const rangeCondition = {};

        if (filterValue.min !== "" && filterValue.min != null) {
          rangeCondition[Op.gte] = Number(filterValue.min);
        }
        if (filterValue.max !== "" && filterValue.max != null) {
          rangeCondition[Op.lte] = Number(filterValue.max);
        }

        // Solo agregar al where si hay al menos un límite válido
        if (Object.keys(rangeCondition).length > 0) {
          whereClause[sequelizeKey] = rangeCondition;
        }
      }
      // ✅ CASO 2: Booleanos
      else if (booleanFields.has(filterKey)) {
        whereClause[sequelizeKey] =
          filterValue === true || filterValue === "true";
      }
      // ✅ CASO 3: Numéricos exactos (si envían un número directo en vez de rango)
      else if (exactMatchFields.has(filterKey)) {
        whereClause[sequelizeKey] = Number(filterValue);
      }
      // ✅ CASO 4: Texto (búsqueda parcial)
      else {
        whereClause[sequelizeKey] = { [Op.iLike]: `%${filterValue}%` };
      }
    }

    // 4. Ejecutar consulta
    const result = await Operation.findAndCountAll({
      include: [
        { model: LegoSet, include: [{ model: Theme }] },
        {
          model: Element,
          include: [
            { model: Color },
            { model: Part, include: [{ model: PartCategory }] },
          ],
        },
      ],
      where: whereClause,
      order: [orderClause],
      limit: rows,
      offset: (page - 1) * rows,
      raw: true,
      subQuery: false,
      distinct: true,
    });

    const flat = result.rows.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [
          key.split(".").pop(),
          value,
        ]),
      ),
    );

    return {
      count: result.count,
      rows: flat,
    };
  },
};
