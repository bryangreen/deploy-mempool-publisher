import ioRedis from "ioredis";

export default class RedisConnection {

  redis: ioRedis.Redis;

  constructor(public options: ioRedis.RedisOptions) {
    this.redis = new ioRedis(options);
    console.log(`connecting to redis on port ${this.options.port}`);

    this.redis.on("error", error => {
      // TODO improve error handling
      console.error(`redis connection error: ${error}`);
    });
  }
}
