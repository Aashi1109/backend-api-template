import { Request, Response, NextFunction } from "express";
import { BadRequestError } from "@/shared/exceptions";

export const validateRequest = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.query, { abortEarly: false });

    if (error) {
      const errorMessage = error.details
        .map((detail: any) => detail.message)
        .join(", ");
      throw new BadRequestError(`Validation error: ${errorMessage}`);
    }

    // Replace req.query with validated data
    req.query = value;
    next();
  };
};

export const validateBody = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      const errorMessage = error.details
        .map((detail: any) => detail.message)
        .join(", ");
      throw new BadRequestError(`Validation error: ${errorMessage}`);
    }

    // Replace req.body with validated data
    req.body = value;
    next();
  };
};

export const validateParams = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.params, { abortEarly: false });

    if (error) {
      const errorMessage = error.details
        .map((detail: any) => detail.message)
        .join(", ");
      throw new BadRequestError(`Validation error: ${errorMessage}`);
    }

    // Replace req.params with validated data
    req.params = value;
    next();
  };
};
