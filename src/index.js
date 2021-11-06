import WebSocket from "ws";

const ws = new WebSocket("wss://api.gateio.ws/ws/v4/");

ws.on("open", function open() {
  console.log('subscribing', 'spot.tickers')
  ws.send(
    JSON.stringify({
      time: Math.round(new Date().getTime() / 1000),
      channel: "spot.tickers",
      event: "subscribe",
      payload: ["BTC_USDT"],
    })
  );
  console.log('subscribed', 'spot.tickers')
});

ws.on("message", function message(data) {
  console.log("received: %s", data);
});

const ws1 = new WebSocket("wss://api.gateio.ws/ws/v4/");

ws1.on("open", function open() {
  console.log('subscribing', 'spot.tickers')
  ws1.send(
    JSON.stringify({
      time: Math.round(new Date().getTime() / 1000),
      channel: "spot.tickers",
      event: "subscribe",
      payload: ["ETH_USDT"],
    })
  );
  console.log('subscribed', 'spot.tickers')
});

ws1.on("message", function message(data
  
  ) {
  console.log("received: %s", data);
});
