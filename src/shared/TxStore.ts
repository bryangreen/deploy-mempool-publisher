import ioredis from 'ioredis';
import { Readable } from "stream";
import { Observable, Subscriber } from "rxjs";

import RedisStore from "./RedisStore";
import { PendingTransaction } from "./PendingTransaction";

class TxStore {

  static keyPrefix = "pendingTx:";
  readonly verboseLogs = false;
  private redis: ioredis.Redis;

  constructor(redisStore: RedisStore) {
    this.redis = redisStore.redis;
  }

  log(statement: string) {
    console.log(`TxStore: ` + statement);
  }

  public save(transaction: PendingTransaction) {
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

  createDataStream(subscriber: Subscriber<string>) {
    let stream = this.getKeyStream();

    this.attachDataEvent(subscriber, stream);
    stream.on("end", () => {
      // Create a new data stream as the previous one has stopped.
      this.createDataStream(subscriber);
    });
  }

  getKeyStream() {
    return this.redis.scanStream({
      match: TxStore.keyPrefix + "*"
    });
  }

  attachDataEvent(subscriber: Subscriber<string>, stream: Readable) {
    stream.on("data", (keys: KeyType[]) => {
      //this.log("Starting scan for matching keys");
      stream.pause();

      if (keys.length > 0) {
        // Loop through all of the keys and send them on
        keys.forEach(key => {
          this.redis.get(key).then(value => {
            if (typeof value === "string") {
              if (this.verboseLogs) {
                this.log(`subscribe post ${value}`);
              }
              subscriber.next(value);
            }
          });
        });

        const pipeline = this.redis.pipeline();
        keys.forEach(key => {
          if (this.verboseLogs) {
            //this.log(`deleting key ${key}`);
          }
          // pipeline.del(key);
        });

        // handle return here
        pipeline.exec();
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

}

export default TxStore;
