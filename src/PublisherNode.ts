import chalk from 'chalk';
import http from 'http';
import socketIo, { Socket } from 'socket.io';
import WebSocket from 'ws';

import { PendingTransaction } from "./shared/PendingTransaction";
import RedisStore from "./shared/RedisStore";
import TxStore from "./shared/TxStore";


interface ParityResponse {
  jsonrpc: string;
  method: string;
  params: { result: Array<PendingTransaction> };
  subscription: string;
}

export default class PublisherNode {
  readonly verboseLogs = false;

  readonly broadcastPort: number;

  readonly redisStore: RedisStore;

  constructor(public endpoint: string) {
    this.redisStore = new RedisStore({ "port": 6379, host: "publisherdb" });

    // pull this from a config file at some point
    this.broadcastPort = 10902;
  }

  static log(statement: string) {
    console.log(chalk.bgYellow.cyan.bold(' PUB ') + statement);
  }

  /**
   *  Saves pending transactions found on parity client node
   */
  listen() {
    const store = new TxStore(this.redisStore);

    const ws = new WebSocket(this.endpoint);

    console.log(`web socket${ws}`);
    ws.on('open', () => {
      console.log('open');
      ws.send('{"method":"parity_subscribe","params":["parity_pendingTransactions"],"id":1,"jsonrpc":"2.0"}');
    });

    ws.on('connection', (ws2, req) => {
      const ip = req.connection.remoteAddress;
    });

    ws.on('message', (data) => {
      if (typeof data === 'string') {
        const parityResponse = JSON.parse(data);
        // eslint-disable-next-line no-prototype-builtins
        if (parityResponse.hasOwnProperty('method')) {
          const pendingTx = (<ParityResponse>parityResponse).params;
          if (pendingTx.result.length > 0) {
            PublisherNode.log(`Saving parity data(size=${data.length}) for total tx=${pendingTx.result.length}`);
            pendingTx.result.forEach((transaction) => {
              // Save the pending transaction
              store.save(transaction);
            });
            // console.log(parityResponse);
          }
        }
      }
    });
  }

  /**
   *  Emits stored pending transactions
   */
  emit() {
    const store = new TxStore(this.redisStore);
    const httpServer = http.createServer().listen(this.broadcastPort, '127.0.0.1');

    const ioListen = socketIo(httpServer, {
      path: '/',
    });
    PublisherNode.log('Emitting stored tx');

    ioListen.on('connection', (socket: Socket) => {
      PublisherNode.log('WS connection success!');

      store.load()
        .subscribe({
          next(value: string) {
            socket.send(value);
            if (false) {
              PublisherNode.log(`message sent: ${(<PendingTransaction>JSON.parse(value)).hash}`);
            }
          },
          complete() {
            PublisherNode.log('Closed emit subscription');
          },
        });
    });
    // .on("disconnect", ());
  }
}
