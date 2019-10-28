#Mempool Publisher

## Starting point
To launch

```
docker-compose up --build
```

Two containers will be launched...
* publisherapp
* publisherdb
    

##TODO
- Fix ws's websocket lost connection (perhaps use web3)...
- Use config files to pass in details like: ethereum node endpoint 
- Refactor out shared Typescript code
- Try using web3 again for pulling from parity node
- Prefer ESLint over TSLint (like on consumer)


There are a lot of similarities between Publisher and Aggregator.

Try a model where there is shared code that can either receive Txs from a websocket, ethereum node ws subscription or JSON-RPC call.


## Ideas
- It wouldn't be hard to be able to stream other data to the aggregator. It would make sense if there is other real-time node specific data to transfer.