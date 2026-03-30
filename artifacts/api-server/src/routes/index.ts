import { Router, type IRouter } from "express";
import healthRouter from "./health";
import chatRouter from "./chat";
import seedRouter from "./seed";
import integrationsRouter from "./integrations";
import contentRouter from "./content";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/chat", chatRouter);
router.use("/seed", seedRouter);
router.use("/integrations", integrationsRouter);
router.use(contentRouter);

export default router;
