import Ajv, { ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import addErrors from "ajv-errors";
import { BadRequestError } from "@/shared/exceptions";

// Initialize AJV with options
const ajv = new Ajv({
  allErrors: true, // Report all validation errors (useful for debugging)
  strict: false, // Disable strict mode to allow custom keywords
  coerceTypes: false, // Do not coerce types (e.g., string "1" to number 1)
  useDefaults: true, // Automatically apply default values from the schema
  removeAdditional: false, // Don't remove additional properties not defined in the schema
});

// Add format validation (e.g., email, uri, date-time)
addFormats(ajv);

// Add custom error messages support
addErrors(ajv);

// Cache for compiled validators
const validatorCache: Record<string, ValidateFunction> = {};

/**
 * Compiles a schema once and caches it for reuse.
 * @param schemaName A unique name for the schema.
 * @param schema The JSON schema to compile.
 * @returns A compiled validation function.
 */
function compileSchema(schemaName: string, schema: object): ValidateFunction {
  if (!validatorCache[schemaName]) {
    // Compile and cache the schema if it hasn't been compiled yet
    validatorCache[schemaName] = ajv.compile(schema);
  }
  return validatorCache[schemaName];
}

/**
 * Validates data against a schema and executes callback if validation passes
 * @param schemaName The unique name of the schema
 * @param schema The JSON schema to validate against
 * @returns A function that validates data and returns callback result if validation passes
 */
export const validateSchema = (schemaName: string, schema: object) => {
  const validate = compileSchema(schemaName, schema);

  return <T, R>(data: T, callback: (validData: T) => R): R => {
    const isValid = validate(data);

    if (!isValid) {
      const errors = (validate.errors || [])
        .map((err) => {
          const path = err.instancePath || "/";
          const keyword = err.keyword;
          const msg = err.message || "Validation error";

          switch (keyword) {
            case "required":
              return `Missing required property "${
                (err.params as any).missingProperty
              }" at ${path}`;
            case "additionalProperties":
              return `Unexpected property "${
                (err.params as any).additionalProperty
              }" at ${path}`;
            case "type":
              return `Invalid type at ${path}, expected ${
                (err.params as any).type
              }`;
            case "enum":
              return `Invalid value at ${path}, expected one of ${(
                err.params as any
              ).allowedValues.join(", ")}`;
            case "minLength":
              return `String at ${path} is too short (minLength: ${
                (err.params as any).limit
              })`;
            case "maxLength":
              return `String at ${path} is too long (maxLength: ${
                (err.params as any).limit
              })`;
            case "minimum":
            case "maximum":
              return `Value at ${path} must be ${keyword} ${
                (err.params as any).limit
              }`;
            default:
              return `${path} ${msg}`;
          }
        })
        .join(", ");

      throw new BadRequestError(errors);
    }

    return callback(data);
  };
};

export default ajv;
