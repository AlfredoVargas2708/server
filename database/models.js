import { Sequelize, DataTypes } from "sequelize";

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  logging: false,
});

const catalog = { timestamps: false };

// ========== CATÁLOGO ==========

const Theme = sequelize.define(
  "Theme",
  {
    theme_id: { type: DataTypes.INTEGER, primaryKey: true },
    theme_name: { type: DataTypes.STRING(100), allowNull: false },
  },
  { ...catalog, tableName: "themes" },
);

const Color = sequelize.define(
  "Color",
  {
    color_id: { type: DataTypes.INTEGER, primaryKey: true },
    color_name: { type: DataTypes.STRING(100), allowNull: false },
    color_rgb: { type: DataTypes.CHAR(6), allowNull: false }, // sin '#'
  },
  { ...catalog, tableName: "colors" },
);

const PartCategory = sequelize.define(
  "PartCategory",
  {
    part_cat_id: { type: DataTypes.INTEGER, primaryKey: true },
    part_cat_name: { type: DataTypes.STRING(100), allowNull: false },
  },
  { ...catalog, tableName: "part_categories" },
);

const Part = sequelize.define(
  "Part",
  {
    part_num: { type: DataTypes.STRING(20), primaryKey: true },
    part_cat_id: { type: DataTypes.INTEGER, allowNull: false },
    part_url: { type: DataTypes.TEXT },
  },
  { ...catalog, tableName: "parts" },
);

const Element = sequelize.define(
  "Element",
  {
    element_id: { type: DataTypes.STRING(20), primaryKey: true },
    part_num: { type: DataTypes.STRING(20), allowNull: false },
    color_id: { type: DataTypes.INTEGER, allowNull: false },
    element_name: { type: DataTypes.STRING(255), allowNull: false },
    element_img_url: { type: DataTypes.TEXT },
  },
  { ...catalog, tableName: "elements" },
);

const LegoSet = sequelize.define(
  "LegoSet",
  {
    set_num: { type: DataTypes.STRING(20), allowNull: true, primaryKey: true },
    name: { type: DataTypes.STRING(255), allowNull: false },
    year: { type: DataTypes.SMALLINT },
    theme_id: { type: DataTypes.INTEGER },
    num_parts: { type: DataTypes.INTEGER },
    set_img_url: { type: DataTypes.TEXT },
    set_url: { type: DataTypes.TEXT },
    last_modified_dt: { type: DataTypes.DATE },
  },
  { ...catalog, tableName: "sets" },
);

// ========== OPERACIÓN ==========

const Operation = sequelize.define(
  "Operation",
  {
    operation_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    task: { type: DataTypes.INTEGER, allowNull: false },
    set_num: { type: DataTypes.STRING(20), allowNull: false },
    element_id: { type: DataTypes.STRING(20), allowNull: false },
    pedido: { type: DataTypes.BOOLEAN, allowNull: false },
    completo: { type: DataTypes.BOOLEAN, allowNull: false },
    cantidad: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 1 },
    },
  },
  {
    tableName: "operations",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
    indexes: [
      { fields: ["task"] },
      { fields: ["set_num"] },
      { fields: ["element_id"] },
      // Descomenta si no quieres duplicados por task/set/pieza:
      // { unique: true, fields: ["task", "set_num", "element_id"] },
    ],
  },
);

// ========== ASOCIACIONES ==========

Theme.hasMany(LegoSet, { foreignKey: "theme_id" });
LegoSet.belongsTo(Theme, { foreignKey: "theme_id" });

PartCategory.hasMany(Part, { foreignKey: "part_cat_id" });
Part.belongsTo(PartCategory, { foreignKey: "part_cat_id" });

Part.hasMany(Element, { foreignKey: "part_num" });
Element.belongsTo(Part, { foreignKey: "part_num" });

Color.hasMany(Element, { foreignKey: "color_id" });
Element.belongsTo(Color, { foreignKey: "color_id" });

LegoSet.hasMany(Operation, { foreignKey: "set_num" });
Operation.belongsTo(LegoSet, { foreignKey: "set_num" });

Element.hasMany(Operation, { foreignKey: "element_id" });
Operation.belongsTo(Element, { foreignKey: "element_id" });

export {
  sequelize,
  Theme,
  Color,
  PartCategory,
  Part,
  Element,
  LegoSet,
  Operation,
};
