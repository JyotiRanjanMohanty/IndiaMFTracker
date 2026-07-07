import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();
const appDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDistPath = path.resolve(appDir, "..", "..", "mf-tracker", "dist", "public");
const frontendIndexPath = path.join(frontendDistPath, "index.html");

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

if (existsSync(frontendDistPath) && existsSync(frontendIndexPath)) {
  app.use(express.static(frontendDistPath));

  app.get(/^\/(?!api(?:\/|$)).*/, (req, res, next) => {
    if (req.path.includes(".")) {
      return next();
    }

    return res.sendFile(frontendIndexPath);
  });
}

export default app;
