import http from 'http';
import socketIo, { Socket } from 'socket.io';
import WebSocket from 'ws';

import { PendingTransaction } from "./shared/PendingTransaction";
import RedisStore from "./shared/RedisStore";
import TxStore from "./shared/TxStore";
import ioClient from "socket.io-client";


interface ParityResponse {
  jsonrpc: string;
  method: string;
  params: { result: Array<PendingTransaction> };
  subscription: string;
}

export default class PublisherNode {
  readonly verboseLogs = true;

  readonly broadcastPort: number;

  readonly redisStore: RedisStore;

  constructor(public endpoint: string) {
    this.redisStore = new RedisStore({ 'port': 6379, host: 'publisherdb' });

    // pull this from a config file at some point
    this.broadcastPort = 10902;
  }

  /**
   *  Saves pending transactions found on parity client node
   */
  listen() {
    const store = new TxStore(this.redisStore);

    const ws = new WebSocket(this.endpoint);

    console.log(`web socket${ws}`);
    ws.on('open', () => {
      console.log(`listen -> WS opening to ${this.endpoint}`);
      ws.send('{"method":"parity_subscribe","params":["parity_pendingTransactions"],"id":1,"jsonrpc":"2.0"}');
    });

    ws.on('connection', (ws2, req) => {
      console.log(`listen -> WS connected.`);
      const ip = req.connection.remoteAddress;
    });

    ws.on('message', (data) => {
      if (typeof data === 'string') {
        const parityResponse = JSON.parse(data);
        // eslint-disable-next-line no-prototype-builtins
        if (parityResponse.hasOwnProperty('method')) {
          const pendingTx = (<ParityResponse>parityResponse).params;
          if (pendingTx.result.length > 0) {
            console.log(`listen -> saving parity_pendingTransactions data(size=${data.length}) for total tx=${pendingTx.result.length}`);

            pendingTx.result.forEach((transaction) => {
              // Save the pending transaction
              store.save(transaction);
              // if(this.verboseLogs) {
              //   console.log(transaction);
              // }
            });
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
    const httpServer = http.createServer().listen(this.broadcastPort, '0.0.0.0');

    const ioListen = socketIo(httpServer, {
      path: '/',
    });

    console.log('emit -> initing stored tx');

    ioListen.on('connection', (socket: Socket) => {
      console.log('emit -> WS connection success!');

      store.load()
        .subscribe({
          next(value: string) {
            socket.send(value);
            if (true) {
              console.log(`emit -> message sent: ${(<PendingTransaction>JSON.parse(value)).hash}`);
            }
          },
          complete() {
            console.log('emit -> closed subscription');
          },
        });
    });
    // .on("disconnect", ());
  }

  /**
   *  Listens on a known port for connections
   */
  listenToListener() {
    const store = new TxStore(this.redisStore);

    const io = ioClient('http://0.0.0.0:10902/', {
      path: '/',
    });

    // const httpServer = http.createServer().listen(10902, '0.0.0.0');
    //
    // const io = socketIo(httpServer, {
    //   path: '/',
    // });
    console.log(`listen2 -> init`);


    io.on('connect', () => {
      console.log('listen2 -> connection made');

      // Connection made - time to receive messages
      io.on('message', (message: string) => {
        const tx = (<PendingTransaction>JSON.parse(message));
        // Message received.
        if (this.verboseLogs) {
          console.log(`listen2 -> message received: ${tx.hash}`);
        }
        store.save(tx);
      });
    }).on('close', () => {
      console.log('listen2 -> close');
    }).on('error', () => {
      console.log('listen2 -> error');
    });
  }

}
