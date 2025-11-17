import { Request, Response, NextFunction } from "express";
import { BadRequestError } from "@/shared/exceptions";

const validateParams = (paramNames: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const missingParams = paramNames.filter((param) => !req.params[param]);

    if (missingParams.length > 0) {
      throw new BadRequestError(
        `Missing required parameters: ${missingParams.join(", ")}`
      );
    }

    next();
  };
};

export default validateParams;
