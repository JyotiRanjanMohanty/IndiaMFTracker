import { Router, type IRouter } from "express";
import healthRouter from "./health";
import fundsRouter from "./funds";
import portfolioRouter from "./portfolio";
import sourceRouter from "./source";

const router: IRouter = Router();

router.use(healthRouter);
router.use(fundsRouter);
router.use(portfolioRouter);
router.use(sourceRouter);

export default router;
