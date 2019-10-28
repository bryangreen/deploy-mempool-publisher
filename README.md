# Mempool Publisher

### Starting point
To launch Publisher:

```
docker-compose up --build
```

Two containers will be launched...
* publisherapp - publisher application (w/ ws server on port 10902)
* publisherdb - redis container (standard port)

The app will start requesting pending tx, save them to redis and open up a websocket.    

## TODO
- Fix ws's websocket reliability (ping/pong?, add-on, different lib, perhaps use web3 1.2.2 with better ws support)
- Use config files to pass in details like: ethereum node endpoint 
- Refactor out shared Typescript code
- Try using web3 again for pulling from parity node
- Prefer ESLint over TSLint (like on consumer)
- Get mempool-monorepo working again (but containerized this time!)
- Unit tests (mock parity client sending pending tx?) 



## Some ideas
- It wouldn't be hard to be able to stream other data to the aggregator. It would make sense if there is other real-time node specific data to transfer.

- There are a lot of similarities between Publisher and Aggregator. Try a model where there is shared code that can either receive Txs from a websocket, ethereum node ws subscription or JSON-RPC call. Aggregator and publisher could share larger amounts of the code base and simply be configured to act as a "publisher" or "aggregator" or both.

