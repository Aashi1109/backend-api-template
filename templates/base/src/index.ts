import { logger } from "./shared";

const type = process.env.APP_TYPE;

import(`./app/${type}`)
  .then(() => {
    logger.info(`App ${type} started`);
  })
  .catch((err) => {
    logger.error(`App ${type} failed to start`, err);
  });
