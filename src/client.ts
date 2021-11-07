import WebSocket from "ws";

(async () => {
  const ws1 = await connectToWebsocket("wss://api.gateio.ws/ws/v4/", 'spot.tickers', ["ETH_USDT"]);
  const ws2 = await connectToWebsocket("wss://api.gateio.ws/ws/v4/", 'spot.tickers', ["BTC_USDT"]);
  const ws3 = await connectToWebsocket("ws://localhost:8080", 'orders', {"pair": "ETH_USDT","price":2000,"amount":0.2});

  ws1.on("message", function message(data: WebSocket.RawData) {
    const response: any = JSON.parse(data.toString());
    switch (response.channel) {
      case "spot.tickers":
        // console.log(`${response.result.currency_pair} ${response.result.last}`);
        ws3.send(`${response.result.currency_pair} ${response.result.last}`);
        break;
      default: 
        console.log("received: %s", response.channel);
    }
  });
  ws3.on("message", function message(data: WebSocket.RawData) {
    console.log("received: %s", data);
  });
})();

async function connectToWebsocket(wsUrl: string, channel: string, payload: any) {
  return new Promise<WebSocket>((resolve, reject) => {
    const ws = new WebSocket(wsUrl);

    ws.on("open", function open() {
      console.log('subscribing', channel)
      ws.send(
        JSON.stringify({
          time: Math.round(new Date().getTime() / 1000),
          channel: "spot.tickers",
          event: "subscribe",
          payload: ["BTC_USDT"],
        })
      );
      console.log('subscribed', channel);
      ws.send(
        JSON.stringify({
          time: Math.round(new Date().getTime() / 1000),
          channel: channel,
          event: "subscribe",
          payload,
        })
      );
      resolve(ws);
    });
  });

}
