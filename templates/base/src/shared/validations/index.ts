import Ajv, { ValidateFunction } from "ajv";
import { BadRequestError } from "../exceptions";

const ajv = new Ajv({ allErrors: true });

export function validateAjvSchema<T>(schema: any, data: T) {
  const validate: ValidateFunction = ajv.compile(schema);
  const valid = validate(data);

  if (!valid) {
    const errors = validate.errors?.map((err) => ({
      field: err.instancePath || err.params?.missingProperty || "root",
      message: err.message,
      params: err.params,
    }));

    throw new BadRequestError("Invalid request payload", errors);
  }

  return data as T;
}
