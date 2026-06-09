import cors = require("cors");
import cookieParser = require("cookie-parser");
import dotenv = require("dotenv");
import express = require("express");
import helmet = require("helmet");
import morgan = require("morgan");
import connectDB = require("./config/db");
import authRoutes = require("./routes/authRoutes");
import eventRoutes = require("./routes/eventRoutes");
import expenseRoutes = require("./routes/expenseRoutes");
import roleRoutes = require("./routes/roleRoutes");
import uploadRoutes = require("./routes/uploadRoutes");
import userRoutes = require("./routes/userRoutes");
import adminSeeder = require("./seeders/adminSeeder");

dotenv.config();

const app = express();
const helmetMiddleware = helmet.default;
const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:3001"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(helmetMiddleware());
app.use(morgan("dev"));
app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static("uploads"));

app.get("/health", (_req, res) => {
  res.json({
    success: true,
    message: "Liquid Ledger API running",
  });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/events", eventRoutes);
app.use("/api/v1/expenses", expenseRoutes);
app.use("/api/v1/roles", roleRoutes);
app.use("/api/v1/upload", uploadRoutes);
app.use("/api/v1/users", userRoutes);

async function startServer(): Promise<void> {
  try {
    await connectDB();
    await adminSeeder();

    app.listen(port, () => {
      console.log(`Liquid Ledger API listening on port ${port}`);
    });
  } catch (error) {
    console.error("Server startup error:", error);
    process.exit(1);
  }
}

void startServer();
