import { Redis } from "@upstash/redis"; // TODO: Uncomment on prod
import { jnparse, jnstringify } from "@/shared/utils";
import { getRedisConnection } from "@/shared/connections";

interface RedisCacheConfig {
  redisClient?: Redis;
  namespace: string;
  defaultTTLSeconds?: number;
}

interface MethodCacheOptions {
  timeToLiveSeconds?: number;
  customKeyGenerator?: (methodArgs: any[]) => string;
  skipCacheGet?: boolean;
  skipCacheSet?: boolean;
}

class RedisCache {
  private readonly redisClient: Redis;
  private readonly cacheNamespace: string;
  private readonly defaultTTLSeconds: number;

  constructor(config: RedisCacheConfig) {
    this.redisClient = getRedisConnection();
    this.cacheNamespace = config.namespace;
    this.defaultTTLSeconds = config.defaultTTLSeconds || 3600;
  }

  /**
   * Decorator to add caching to methods
   * @param {Object} methodOptions - Options for the cache
   * @param {number} [methodOptions.timeToLiveSeconds] - Time to live in seconds
   * @param {Function} [methodOptions.customKeyGenerator] - Custom key generator function
   * @returns {Function} Decorated method
   *
   * @example
   *
   * class MyService {
   *   @RedisCache.withCache()
   *   async myMethod(arg1: string, arg2: number) {
   *     return this.myMethod(arg1, arg2);
   *   }
   * }
   *
   */
  withCache(methodOptions: MethodCacheOptions = {}): Function {
    // Capture redis instance variables in closure
    const redisClient = this.redisClient;
    const cacheNamespace = this.cacheNamespace;
    const defaultTTL = this.defaultTTLSeconds;

    return function (
      target: any,
      methodName: string,
      descriptor: PropertyDescriptor
    ) {
      const originalMethod = descriptor.value;
      const _options: MethodCacheOptions = {
        timeToLiveSeconds: defaultTTL,
        skipCacheGet: false,
        skipCacheSet: false,
        ...methodOptions,
      };

      descriptor.value = async function (...methodArgs: any[]) {
        // Build cache key
        const keyPart = methodOptions.customKeyGenerator
          ? methodOptions.customKeyGenerator(methodArgs)
          : `${methodName}:${JSON.stringify(methodArgs)}`;
        const cacheKey = `${cacheNamespace}:${keyPart}`;

        try {
          // Try cache first if not skipped
          if (!methodOptions.skipCacheGet) {
            const cachedResult = (await redisClient.get(cacheKey)) as string;
            if (cachedResult) return JSON.parse(cachedResult);
          }

          // If not in cache, call original method
          // 'this' here correctly refers to the service instance
          const databaseResult = await originalMethod.apply(this, methodArgs);

          // Cache the result if successful
          if (
            !methodOptions.skipCacheSet &&
            databaseResult &&
            !databaseResult.error
          )
            await redisClient.setex(
              cacheKey,
              _options.timeToLiveSeconds!,
              JSON.stringify(databaseResult)
            );

          return databaseResult;
        } catch (error) {
          // Fallback to original method if cache fails
          return originalMethod.apply(this, methodArgs);
        }
      };

      return descriptor;
    };
  }

  async invalidateCache(pattern: string): Promise<void> {
    try {
      const fullPattern = `${this.cacheNamespace}:${pattern}`;
      const matchingKeys = await this.redisClient.keys(fullPattern);
      if (matchingKeys.length > 0) {
        await this.redisClient.del(...matchingKeys);
      }
    } catch (error) {
      console.error("Redis cache invalidation failed:", error);
    }
  }

  setItem(key: string, value: any, ttl?: number) {
    const namespacedKey = `${this.cacheNamespace}:${key}`;
    // return this.redisClient.set(namespacedKey, jnstringify(value), {
    //   ex: ttl || this.defaultTTLSeconds,
    // }); // TODO: Uncomment on prod
    return this.redisClient.set(namespacedKey, jnstringify(value), {
      ex: ttl || this.defaultTTLSeconds,
    });
  }

  async getItem<T>(key: string): Promise<T | null> {
    const namespacedKey = `${this.cacheNamespace}:${key}`;
    const result = await this.redisClient.get(namespacedKey);
    return result === "string" ? jnparse(result) : (result as T | null);
  }

  setHKey(key: string, field: string, value: any, ttl?: number) {
    const namespacedKey = `${this.cacheNamespace}:${key}`;
    const pipeLine = this.redisClient.pipeline();
    pipeLine.hset(namespacedKey, { [field]: jnstringify(value) });
    if (ttl) pipeLine.expire(namespacedKey, ttl);
    return pipeLine.exec();
  }

  getHKey(key: string, field: string) {
    const namespacedKey = `${this.cacheNamespace}:${key}`;
    return this.redisClient.hget(namespacedKey, field);
  }

  getHKeys(key: string) {
    const namespacedKey = `${this.cacheNamespace}:${key}`;
    return this.redisClient.hgetall(namespacedKey);
  }

  setList(key: string, value: any, ttl?: number) {
    const namespacedKey = `${this.cacheNamespace}:${key}`;
    return this.redisClient.lpush(namespacedKey, jnstringify(value));
  }

  getList(key: string) {
    const namespacedKey = `${this.cacheNamespace}:${key}`;
    return this.redisClient.lrange(namespacedKey, 0, -1);
  }

  deleteItem(key: string) {
    const namespacedKey = `${this.cacheNamespace}:${key}`;
    return this.redisClient.del(namespacedKey);
  }

  deleteHKey(key: string, field: string) {
    const namespacedKey = `${this.cacheNamespace}:${key}`;
    return this.redisClient.hdel(namespacedKey, field);
  }

  getPipeline() {
    return this.redisClient.pipeline();
  }

  /**
   * Wraps an async function with caching logic.
   * @param fn The async function to wrap.
   * @param options Cache options.
   * @returns A new function with the same signature as fn, but with caching.
   */
  cacheWrapper<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    options: MethodCacheOptions = {}
  ): (...args: Parameters<T>) => Promise<ReturnType<T>> {
    // const redisClient = this.redisClient;
    // const cacheNamespace = this.cacheNamespace;
    // const defaultTTL = this.defaultTTLSeconds;

    return async function (...args: Parameters<T>): Promise<ReturnType<T>> {
      const keyPart = options.customKeyGenerator
        ? options.customKeyGenerator(args)
        : `${fn.name}:${JSON.stringify(args)}`;
      const cacheKey = `${this.cacheNamespace}:${keyPart}`;
      const ttl = options.timeToLiveSeconds || this.defaultTTLSeconds;

      try {
        if (!options.skipCacheGet) {
          const cachedResult = await this.getItem(cacheKey);
          if (cachedResult) return cachedResult;
        }

        const result = await fn(...args);

        if (!options.skipCacheSet && result && !result.error) {
          await this.setItem(cacheKey, result, ttl);
        }

        return result;
      } catch (error) {
        return fn(...args);
      }
    };
  }

  updateValue(key: string, newValue: any) {
    const namespacedKey = `${this.cacheNamespace}:${key}`;
    return this.redisClient.set(namespacedKey, jnstringify(newValue), {
      keepTtl: true,
    });
  }

  getTTL(key: string) {
    const namespacedKey = `${this.cacheNamespace}:${key}`;
    return this.redisClient.ttl(namespacedKey);
  }

  setTTL(key: string, ttl: number) {
    const namespacedKey = `${this.cacheNamespace}:${key}`;
    return this.redisClient.expire(namespacedKey, ttl);
  }

  get defaultTTLMs() {
    return this.defaultTTLSeconds;
  }

  get namespace() {
    return this.cacheNamespace;
  }
}

export default RedisCache;
