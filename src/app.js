import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import { fileURLToPath } from "node:url";

import authRoutes from "./routes/auth.js";
import eventRoutes from "./routes/events.js";
import eventInvitationRoutes from "./routes/eventInvitations.js";
import groupRoutes from "./routes/groups.js";
import groupInvitationRoutes from "./routes/groupInvitations.js";
import userRoutes from "./routes/users.js";

const app = express();

const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const rateLimitMessage = {
  message: "Too many requests, try again later."
};

app.use(helmet());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// Auth is stricter because login and registration are the brute-force surface.
// The rest of the API keeps a higher limit for normal use.
app.use(
  "/api/auth",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: rateLimitMessage
  })
);

app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: rateLimitMessage
  })
);

const openApiPath = fileURLToPath(new URL("./docs/openapi.yaml", import.meta.url));

app.get("/api/openapi.yaml", (req, res) => {
  res.type("yaml").sendFile(openApiPath);
});

app.use(
  "/api/docs",
  helmet({ contentSecurityPolicy: false }),
  swaggerUi.serve,
  swaggerUi.setup(null, {
    swaggerOptions: { url: "/api/openapi.yaml" }
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/group-invitations", groupInvitationRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/event-invitations", eventInvitationRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Resource not found" });
});

app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    res.status(400).json({ message: "Invalid JSON" });
    return;
  }

  console.error(error);
  res.status(500).json({ message: "Internal server error" });
});

export default app;
