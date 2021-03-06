import config from 'config';
import http from 'http';
import socketIo, { Socket } from 'socket.io';
import WebSocket from 'ws';

import { IPendingTransaction } from './shared/IPendingTransaction';
import RedisConnection from './shared/RedisConnection';
import TxStore from './shared/TxStore';

interface IParityResponse {
  jsonrpc: string;
  method: string;
  params: { result: Array<IPendingTransaction> };
  subscription: string;
}

export default class PublisherNode {
  readonly verboseLogs: boolean = config.get('log.level');
  readonly showStats: boolean = config.get('log.stats');

  txStore: TxStore;

  constructor() {
    const redisConnection = new RedisConnection({
      port: config.get('store.port'),
      host: config.get('store.host')
    });

    this.txStore = new TxStore(redisConnection);
  }

  /**
   *  Saves pending transactions found on parity client node
   */
  extract() {
    const endpoint: string = config.get('extract.endpoint');

    const ws = new WebSocket(endpoint);

    ws.on('open', () => {
      console.log(`extract -> WS opening to ${endpoint}`);

      // TODO try this again with a web3 abstract subscription (web3 2.x)
      ws.send('{"method":"parity_subscribe","params":["parity_pendingTransactions"],"id":1,"jsonrpc":"2.0"}');
    });

    ws.on('connection', (ws2, req) => {
      console.log(`extract -> WS connected to ${endpoint}`);

    }).on('message', (data) => {
      console.log('extract -> message received' + data);
      if (typeof data === 'string') {
        const parityResponse = JSON.parse(data);

        // eslint-disable-next-line no-prototype-builtins
        if (parityResponse.hasOwnProperty('method')) {
          const pendingTx = (<IParityResponse>parityResponse).params;

          if (pendingTx.result.length > 0) {
            console.log(`extract -> saving parity_pendingTransactions data(size=${data.length}) for total tx=${pendingTx.result.length}`);

            pendingTx.result.forEach((transaction) => {
              // Save the pending transaction in the store
              this.txStore.saveNew(transaction);

              if (this.verboseLogs) {
                console.log(`extract -> received tx with hash=${transaction.hash}`);
              }
            });
            if (this.showStats) {
              console.log(`extract -> tx received ${this.txStore.txReceived}, tx saved ~${this.txStore.txSaved}`)
            }
          }
        }
      }
    });
  }

  /**
   *  Publishes stored pending transactions from the datastore to clients of a websocket.
   *  This is a websocket server.
   */
  publish() {
    const host: string = config.get('publish.host');
    const port: number = config.get('publish.port');

    // TODO pass in the hostname from a configuration file?
    const httpServer = http.createServer().listen(port, host);

    const ioListen = socketIo(httpServer, {
      path: '/',
    });
    console.log(`publish -> serving tx via ws at ${host}:${port}`);

    const that = this;
    ioListen.on('connection', (socket: Socket) => {
      console.log(`publish -> ws connection made from ${socket.conn.remoteAddress}`);

      this.txStore.load(true)
        .subscribe({
          next(value: string) {
            socket.send(value);

            if (that.verboseLogs) {
              console.log(`publish -> message sent: ${(<IPendingTransaction>JSON.parse(value)).hash}`);
            }
          },

          complete() {
            // The subscription should never finish.
            console.log('publish -> closed subscription');
          },
        });
    }).on('disconnecting', (socket: Socket) => {
      console.log(`publish -> ws disconnect from ${socket.conn.remoteAddress}`);
    });
  }

}
