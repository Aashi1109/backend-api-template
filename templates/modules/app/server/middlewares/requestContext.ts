import { IRequestContext, RequestContext } from "../contexts";
import { getAlphaNumericId, logger } from "@/shared";
import { Request, Response, NextFunction } from "express";

const requestContextMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Generate a unique request ID or use one from headers if provided
  const requestId =
    (req.headers["x-request-id"] as string) || getAlphaNumericId();

  const startTime = Date.now();

  const context: IRequestContext = {
    requestId,
    timings: {
      start: startTime,
    },
  };

  try {
    RequestContext.run(context, async () => {
      next();
    });
  } catch (error) {
    logger.error("In context error", error);
  }
};

export default requestContextMiddleware;
