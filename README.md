# Gate.io automated trader in NodeJS

Simple NodeJS project using the Gate.io API websockets and a Cassandra database hosted on Datastax.

Allows to put trades automatically based on a list of orders, without having to lock any funds.

- Fetches user orders from the Cassandra database
- Connect to the corresponding Gate.io websockets
- Suscribe to pairs that are on the user orders list on Datastax
- Take the trades when the price is reached for a given pair!

# Reference

- Gate.io API websockets https://www.gate.io/docs/developers/apiv4/ws/en/

- AstraDB https://astra.datastax.com

# Setup

## Datastax

- Create an account on AstraDB
- Create a DB
- Create a user and get an API key

## Gate.io

- Create an account on Gate.io
- Fund it
- Create an API key with trading permissions

## Edit the .env file

- Copy the .env.sample file to a new file .env

```
npm i
npm start:dev
```
