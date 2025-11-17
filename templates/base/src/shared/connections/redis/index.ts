import config from "@/config";
import { Redis } from "@upstash/redis";

import { REDIS_CONNECTION_NAMES } from "@/shared/constants";

const redisConnections: Partial<Record<REDIS_CONNECTION_NAMES, Redis>> = {};

export const getRedisConnections = () => redisConnections;

const connect = (name: REDIS_CONNECTION_NAMES) => {
  return new Redis({
    url: config.redis[name].url,
    token: config.redis[name].token,
  });
};

export async function disconnectRedisConnections() {
  const disconnecting = [];
  for (const name of Object.keys(redisConnections)) {
    disconnecting.push(redisConnections[name].close());
  }
  return Promise.all(disconnecting);
}

export function getRedisConnection(name?: REDIS_CONNECTION_NAMES.Default) {
  name ??= REDIS_CONNECTION_NAMES.Default;
  if (redisConnections[name]) {
    return redisConnections[name];
  }
  if (!config.redis[name]) {
    throw new Error(`Redis connection not exists: ${name}`);
  }
  redisConnections[name] = connect(name);
  return redisConnections[name];
}
