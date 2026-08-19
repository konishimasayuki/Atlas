// api/_lib/redis.js
import { Redis } from "@upstash/redis";

// UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN を環境変数から読む
export const redis = Redis.fromEnv();
