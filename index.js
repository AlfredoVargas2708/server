import express from "express";
import cors from "cors";
import api from "./routes/index.js";

const PORT = process.env.PORT || 3000;

const app = express();
app.use(
  cors({
    origin: [
      "https://app-blond-xi-77.vercel.app",
      "http://localhost:5173",
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  }),
);
app.use(express.json());

app.use("/api", api);

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
