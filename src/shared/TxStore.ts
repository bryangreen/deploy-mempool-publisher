import ioredis from 'ioredis';
import { Readable } from 'stream';
import { Observable, Subscriber } from 'rxjs';

import RedisConnection from './RedisConnection';
import { IPendingTransaction } from './IPendingTransaction';

export default class TxStore {
  static pendingKeyPrefix = 'pendingtx:';
  static streamedKeyPrefix = 'sent:';

  readonly verboseLogs = false;

  public txReceived = 0;
  public txSaved = 0;

  redis: ioredis.Redis;

  constructor(redisStore: RedisConnection) {
    this.redis = redisStore.redis;
  }

  log(statement: string) {
    console.log(`TxStore: ${statement}`);
  }

  /**
   * Save only new keys to redis in the form 'key prefix' + tx hash
   * The value will be a JSON string of the transaction details
   * @param transaction
   */
  public saveNew(transaction: IPendingTransaction) {
    const pendingKeyName = TxStore.pendingKeyPrefix + transaction.hash;
    this.txReceived += 1;

    this.redis.exists(TxStore.streamedKeyPrefix + pendingKeyName).then(exists => {
      if (!exists) {
        this.saveTransactionByKey(pendingKeyName, transaction);
      } else {
        if (this.verboseLogs) {
          this.log(`tx already saved/sent: ${transaction.hash}`);
        }
      }
    });
  }

  /**
   * Save keys to redis in the form 'key prefix' + tx hash
   * The value will be a JSON string of the transaction details
   * @param transaction
   */
  public save(transaction: IPendingTransaction) {
    this.txReceived += 1;
    this.saveTransactionByKey(TxStore.pendingKeyPrefix + transaction.hash, transaction);
  }

  private saveTransactionByKey(key: string, transaction: IPendingTransaction) {
    this.redis.set(key, JSON.stringify(transaction))
      .then(result => {
        // TODO handle when their result is not OK
        if (this.verboseLogs) {
          this.log(`saved tx with result:${result} hash:${transaction.hash}`);
        }
        this.txSaved += 1;
      })
      .catch(reason => {
        console.error(`store -> could not add to redis ${reason}`);
      });
  }

  public load(uniqueAfterLoad = false): Observable<string> {
    return new Observable<string>(subscriber => {
      this.createDataStream(subscriber, uniqueAfterLoad);
    });
  }

  /**
   * Stream out keys from the redis database
   *
   * If the pub/sub model could dedup keys then a subscription to redis would work...
   * @param subscriber
   */
  createDataStream(subscriber: Subscriber<string>, uniqueAfterLoad: boolean) {
    let stream = this.getKeyStream();

    this.attachDataEvent(subscriber, stream, uniqueAfterLoad);
    stream.on("end", () => {
      // Create a new data stream as the previous one has stopped.
      this.createDataStream(subscriber, uniqueAfterLoad);
    });
  }

  /**
   * Stream all keys that match
   */
  getKeyStream() {
    return this.redis.scanStream({
      match: TxStore.pendingKeyPrefix + "*"
    });
  }

  attachDataEvent(subscriber: Subscriber<string>, stream: Readable, uniqueAfterLoad: boolean) {
    stream.on("data", (keys: KeyType[]) => {
      stream.pause();

      if (keys.length > 0) {
        // Loop through all of the keys and send them on
        keys.forEach(key => {
          this.redis.get(key).then(value => {
            if (typeof value === "string") {
              subscriber.next(value);

              if (this.verboseLogs) {
                this.log(`subscribe post ${key}`);
              }
            }
          });
        });
        if (uniqueAfterLoad) {
          this.renameStreamedKeys(keys);
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

  private renameStreamedKeys(keys: KeyType[]) {
    const pipeline = this.redis.pipeline();
    keys.forEach(key => {
      if (this.verboseLogs) {
        this.log(`rename streamed key ${key}`);
      }
      pipeline.rename(key, TxStore.streamedKeyPrefix + key);
    });

    // TODO handle return value of exec
    pipeline.exec();
  }
}
