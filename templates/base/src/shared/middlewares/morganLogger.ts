import logger from "@/shared/logger";
import morgan from "morgan";

const stream = {
  // Use the http severity
  write: (message: string) => logger.http(message),
};

const skip = () => false;

const morganMiddleware = morgan(
  ":remote-addr :method :url :status :res[content-length] - :response-time ms",

  { stream, skip }
);

export default morganMiddleware;
