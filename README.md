#Mempool Publisher

## Starting point
To launch

```
docker-compose up --build
```

Two containers will be launched
* publisherapp
* publisherdb
    

##TODO
- Use config files to pass in details like: ethereum node endpoint 
- Refactor out shared Typescript code
- Try using web3 again for pulling from parity node
