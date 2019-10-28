import http from 'http';
import socketIo, { Socket } from 'socket.io';
import WebSocket from 'ws';

import { IPendingTransaction } from './shared/IPendingTransaction';
import RedisConnection from './shared/RedisConnection';
import TxStore from './shared/TxStore';

interface ParityResponse {
  jsonrpc: string;
  method: string;
  params: { result: Array<IPendingTransaction> };
  subscription: string;
}

export default class PublisherNode {
  // TODO Add log levels here and control via configuration file.
  readonly verboseLogs = false;

  // TODO Add this to a configuration file so this can be passed in
  readonly emitPort = 10902;

  readonly dataStorePort = 6379;
  readonly dataStoreHost = 'publisherdb';

  txStore: TxStore;

  constructor(public parityEndpoint: string) {
    const redisConnection = new RedisConnection({
      port: this.dataStorePort,
      host: this.dataStoreHost
    });

    this.txStore = new TxStore(redisConnection);
  }

  /**
   *  Saves pending transactions found on parity client node
   */
  pullTxs() {
    const ws = new WebSocket(this.parityEndpoint);

    ws.on('open', () => {
      console.log(`listen -> WS opening to ${this.parityEndpoint}`);

      // TODO try this again with a web3 requst
      ws.send('{"method":"parity_subscribe","params":["parity_pendingTransactions"],"id":1,"jsonrpc":"2.0"}');
    });

    ws.on('connection', (ws2, req) => {
      console.log(`listen -> WS connected.`);

    }).on('message', (data) => {
      if (typeof data === 'string') {
        const parityResponse = JSON.parse(data);

        // eslint-disable-next-line no-prototype-builtins
        if (parityResponse.hasOwnProperty('method')) {
          const pendingTx = (<ParityResponse>parityResponse).params;

          if (pendingTx.result.length > 0) {
            console.log(`listen -> saving parity_pendingTransactions data(size=${data.length}) for total tx=${pendingTx.result.length}`);

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
   *  Emits stored pending transactions from the datastore to a websocket.
   *  This is a websocket server.
   */
  publishTxs() {
    // TODO pass in the hostname from a configuration file?
    const httpServer = http.createServer().listen(this.emitPort, '0.0.0.0');

    const ioListen = socketIo(httpServer, {
      path: '/',
    });

    console.log('emit -> initing stored tx');
    const that = this;
    ioListen.on('connection', (socket: Socket) => {
      console.log('emit -> ws connection success!');

      this.txStore.load()
        .subscribe({
          next(value: string) {
            socket.send(value);
            if (that.verboseLogs) {
              console.log(`emit -> message sent: ${(<IPendingTransaction>JSON.parse(value)).hash}`);
            }
          },
          complete() {
            // The subscription should never finish.
            console.log('emit -> closed subscription');
          },
        });
    });

    // TODO gracefully and properly handle disconnects from redis (auto-reconnect?)
    // .on("disconnect", ());

  }

}
