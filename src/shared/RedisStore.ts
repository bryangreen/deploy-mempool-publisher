import ioredis from "ioredis";

export default class RedisStore {

  redis: ioredis.Redis;

  constructor(public options: ioredis.RedisOptions) {
    console.log(`connecting to redis on port ${this.options.port}`);
    this.redis = new ioredis(options);

    this.redis.on("error", error => {
      console.error(`redis connection error: ${error}`);
    });
  }
}
