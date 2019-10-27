import ioredis from "ioredis";

export default class RedisStore {

  redis: ioredis.Redis;

  constructor(public port: number) {
    console.log(`connecting to redis on port ${this.port}`);
    this.redis = new ioredis(this.port);

    this.redis.on("error", error => {
      console.error(`redis connection error: ${error}`);
    });
  }
}
