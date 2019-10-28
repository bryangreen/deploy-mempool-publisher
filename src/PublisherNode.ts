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
  // TODO Add log levels here and control via configuration file.
  readonly verboseLogs = false;

  // TODO Add config fields to a configuration file so they can be tested for dev/stage/prod or multi-publisher
  readonly dataStoreHost = 'publisherdb'; // name of the docker redis container
  readonly dataStorePort = 6379;

  readonly publishHost = '0.0.0.0';
  readonly publishPort = 10902;

  txStore: TxStore;

  constructor(public parityEndpoint: string) {
    const redisConnection = new RedisConnection({
      port: this.dataStorePort,
      host: this.dataStoreHost
    });

    // TODO may want to turn deletion of keys back on or improve streaming logic to prevent dups
    this.txStore = new TxStore(redisConnection);
  }

  /**
   *  Saves pending transactions found on parity client node
   */
  extract() {
    const ws = new WebSocket(this.parityEndpoint);

    ws.on('open', () => {
      console.log(`extract -> WS opening to ${this.parityEndpoint}`);

      // TODO try this again with a web3 abstract subscription (web3 2.x)
      ws.send('{"method":"parity_subscribe","params":["parity_pendingTransactions"],"id":1,"jsonrpc":"2.0"}');
    });

    ws.on('connection', (ws2, req) => {
      console.log(`extract -> WS connected to ${this.parityEndpoint}`);

    }).on('message', (data) => {
      if (typeof data === 'string') {
        const parityResponse = JSON.parse(data);

        // eslint-disable-next-line no-prototype-builtins
        if (parityResponse.hasOwnProperty('method')) {
          const pendingTx = (<IParityResponse>parityResponse).params;

          if (pendingTx.result.length > 0) {
            console.log(`extract -> saving parity_pendingTransactions data(size=${data.length}) for total tx=${pendingTx.result.length}`);

            pendingTx.result.forEach((transaction) => {
              // Save the pending transaction in the store
              this.txStore.save(transaction);

              if (this.verboseLogs) {
                console.log(transaction);
              }
            });
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
    // TODO pass in the hostname from a configuration file?
    const httpServer = http.createServer().listen(this.publishPort, this.publishHost);

    const ioListen = socketIo(httpServer, {
      path: '/',
    });
    console.log(`publish -> serving tx via ws on port ${this.publishHost}:${this.publishPort}`);

    const that = this;
    ioListen.on('connection', (socket: Socket) => {
      console.log('publish -> ws connection made');

      this.txStore.load()
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
    });
  }

}
