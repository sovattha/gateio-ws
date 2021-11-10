import { catchError, fromEvent, map, merge, mergeMap, Observable, tap } from 'rxjs';
import WebSocket, { MessageEvent } from 'ws';

(async () => {

  const ws0 = connectToWebsocket('wss://api.gateio.ws/ws/v4/', 'spot.tickers', ['LTC_USDT']);
  const ws1 = connectToWebsocket('wss://api.gateio.ws/ws/v4/', 'spot.tickers', ['ETH_USDT']);
  const ws2 = connectToWebsocket('wss://api.gateio.ws/ws/v4/', 'spot.tickers', ['BTC_USDT']);
  const ws3 = await connectToWebsocket('ws://localhost:8080', 'orders');
  const [ws0$, ws1$, ws2$, ws3$] = await Promise.all([ws0, ws1, ws2, ws3]).then((data) => 
    Promise.all(data.map(w => fromEvent(w, 'message') as Observable<MessageEvent>))
  );

  const ws5$ = ws3$.pipe(
    map((value) => JSON.parse(value.data.toString()) as any),
    tap((response) => {
      console.log(`${response.channel} = ${response.payload?.pair} ${response.payload?.price} ${response.payload?.amount}`);
    }),
  );

  const ws4$ = merge(ws0$, ws1$, ws2$).pipe(
    map((value) => JSON.parse(value.data.toString()) as any),
    tap((response) => {
      console.log(`${response.channel} = ${response.result?.currency_pair || ''} - ${response.result?.last || ''} ${response.result?.status || ''}`);
    }),
    tap((response) => {
      if (response.result?.currency_pair) {
        ws3.send(JSON.stringify({channel: 'orders', payload: { pair: response.result?.currency_pair, price: response.result?.last, amount: 1} }));
      }
    }),
  );
  
  merge(ws5$, ws4$).pipe(
    catchError((err, caught) => {
      console.log('error: ', err)
      return caught;
    }),
  ).subscribe();
  
})();

async function connectToWebsocket(wsUrl: string, channel: string, payload?: any) {
  const ws = new WebSocket(wsUrl);
  return new Promise<WebSocket>((resolve, reject) => {
    if (payload) {
      ws.on('open', function open() {
        console.log('subscribing', channel, payload)
        ws.send(
          JSON.stringify({
            time: Math.round(new Date().getTime() / 1000),
            channel: channel,
            event: 'subscribe',
            payload,
          })
        );
        console.log('subscribed', channel, payload);
        resolve(ws);
      });
    } else resolve(ws);
  });
}
