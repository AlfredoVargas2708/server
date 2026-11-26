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

const splitBody = (body) =>
  Object.fromEntries(
    Object.entries(FIELDS).map(([entity, keys]) => [entity, pick(body, keys)]),
  );

const pick = (source, keys) =>
  Object.fromEntries(
    keys.filter((k) => source[k] !== undefined).map((k) => [k, source[k]]),
  );

async function ensure(Model, data, pk, transaction) {
  // Solo ignorar si es undefined o null, permitir 0 como valor válido
  if (data[pk] === undefined || data[pk] === null) return;
  const { [pk]: id, ...defaults } = data;
  await Model.findOrCreate({ where: { [pk]: id }, defaults, transaction });
}

export { splitBody, pick, ensure };
