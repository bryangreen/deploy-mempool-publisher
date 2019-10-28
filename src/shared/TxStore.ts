import ioredis from 'ioredis';
import { Readable } from 'stream';
import { Observable, Subscriber } from 'rxjs';

import RedisConnection from './RedisConnection';
import { IPendingTransaction } from './IPendingTransaction';

export default class TxStore {
  static keyPrefix = 'pendingTx:';

  readonly verboseLogs = false;

  redis: ioredis.Redis;

  constructor(redisStore: RedisConnection, deleteStreamedKeys = false) {
    this.redis = redisStore.redis;
  }

  log(statement: string) {
    console.log(`TxStore: ${statement}`);
  }

  /**
   * Save keys to redis in the form 'key prefix' + tx hash
   * The value will be a JSON string of the transaction details
   * @param transaction
   */
  public save(transaction: IPendingTransaction) {
    this.redis.set(TxStore.keyPrefix + transaction.hash, JSON.stringify(transaction))
      .then(result => {
        // added
        if (this.verboseLogs) {
          this.log(`saved tx result: ${result} hash: ${transaction.hash}`);
        }
      })
      .catch(reason => {
        console.error(`could not add to redis = ${reason}`);
      });
  }

  public load(): Observable<string> {
    return new Observable<string>(subscriber => {
      this.createDataStream(subscriber);
    });
  }

  /**
   * Stream out keys from the redis database
   *
   * If the pub/sub model could dedup keys then a subscription to redis would work...
   * @param subscriber
   */
  createDataStream(subscriber: Subscriber<string>) {
    let stream = this.getKeyStream();

    this.attachDataEvent(subscriber, stream);
    stream.on("end", () => {
      // Create a new data stream as the previous one has stopped.
      this.createDataStream(subscriber);
    });
  }

  /**
   * Stream all keys that match
   */
  getKeyStream() {
    return this.redis.scanStream({
      match: TxStore.keyPrefix + "*"
    });
  }

  attachDataEvent(subscriber: Subscriber<string>, stream: Readable) {
    stream.on("data", (keys: KeyType[]) => {
      if (this.verboseLogs) {
        this.log("Starting scan for matching keys");
      }
      stream.pause();

      if (keys.length > 0) {
        // Loop through all of the keys and send them on
        keys.forEach(key => {
          this.redis.get(key).then(value => {
            if (typeof value === "string") {
              subscriber.next(value);

              if (this.verboseLogs) {
                this.log(`subscribe post ${value}`);
              }
            }
          });
        });
        if (this.deleteStreamedKeys) {
          this.deleteStreamedKeys(keys);
        }
      }
      stream.resume();
    }).on("end", () => {
      //this.log("Scanstream end.");
    }).on("close", () => {
      this.log("Scanstream closed.");
    }).on("error", () => {
      this.log("Scanstream error.");
    });

  }

  private deleteStreamedKeys(keys: KeyType[]) {

    const pipeline = this.redis.pipeline();
    keys.forEach(key => {
      if (this.verboseLogs) {
        this.log(`deleting key ${key}`);
      }
       pipeline.del(key);
    });

    // handle return here
    pipeline.exec();
  }
}
