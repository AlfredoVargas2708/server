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
  if (!data[pk]) return;
  const { [pk]: id, ...defaults } = data;
  await Model.findOrCreate({ where: { [pk]: id }, defaults, transaction });
}

export const DatabaseController = {
  async createOperacion(body) {
    const { operation, set, element, theme, color, part, partCat } =
      splitBody(body);

    return sequelize.transaction(async (t) => {
      await ensure(Theme, theme, "theme_id", t);
      await ensure(Color, color, "color_id", t);
      await ensure(PartCategory, partCat, "part_cat_id", t);
      await ensure(Part, part, "part_num", t);
      await ensure(Element, element, "element_id", t);
      await ensure(LegoSet, set, "set_num", t);

      return Operation.create(operation, { transaction: t });
    });
  },
};
