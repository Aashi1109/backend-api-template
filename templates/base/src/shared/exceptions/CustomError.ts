/**
 * Represents a custom error object that extends the built-in Error class.
 * @class CustomError
 * @extends Error
 */
class CustomError extends Error {
  /**
   * Error message.
   * @type {string}
   */
  message!: string;

  /**
   * HTTP status code associated with the error.
   * @type {number}
   */
  status!: number;

  /**
   * Additional information about the error.
   * @type {any}
   */
  additionalInfo!: any;

  /**
   * Creates a new instance of CustomError.
   * @constructor
   * @param {string} message - The error message.
   * @param {number} [status=500] - The HTTP status code associated with the error. Default is 500 (Internal Server Error).
   * @param {any} [additionalInfo=undefined] - Additional information about the error.
   */
  constructor(
    message: string,
    status: number = 500,
    additionalInfo: any = undefined
  ) {
    super(message);
    Object.setPrototypeOf(this, CustomError.prototype);
    this.message = message;
    this.status = status;
    this.additionalInfo = additionalInfo;
  }
}

/**
 * Represents the structure of an error response.
 * @interface IResponseError
 */
interface IResponseError {
  /**
   * Error message.
   * @type {string}
   */
  message: string;

  /**
   * Additional information about the error.
   * @type {string | undefined}
   */
  additionalInfo?: string;
}

export { IResponseError };

export default CustomError;
