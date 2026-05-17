import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

import uploadRoutes
from "./routes/uploadRoutes.js";

import aiRoutes
from "./routes/aiRoutes.js";

const app = express();

app.use(cors());

app.use(express.json({
  limit: "50mb",
}));

app.use(
  "/api/upload",
  uploadRoutes
);

app.use(
  "/api/ai",
  aiRoutes
);

app.get("/", (req, res) => {
  res.json({
    message:
      "AI Document Assistant API Running",
  });
});

const PORT =
  process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(
    `Server running on port ${PORT}`
  );
});