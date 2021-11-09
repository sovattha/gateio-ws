import { catchError, fromEvent, map, merge, mergeMap, Observable, tap } from 'rxjs';
import WebSocket, { MessageEvent } from 'ws';

(async () => {

  const ws0 = await connectToWebsocket('wss://api.gateio.ws/ws/v4/', 'spot.tickers', ['LTC_USDT']);
  const ws1 = await connectToWebsocket('wss://api.gateio.ws/ws/v4/', 'spot.tickers', ['ETH_USDT']);
  const ws2 = await connectToWebsocket('wss://api.gateio.ws/ws/v4/', 'spot.tickers', ['BTC_USDT']);
  const ws3 = await connectToWebsocket('ws://localhost:8080', 'orders');

  const ws0$ = (fromEvent(ws0, 'message') as Observable<MessageEvent>);
  const ws1$ = (fromEvent(ws1, 'message') as Observable<MessageEvent>);
  const ws2$ = (fromEvent(ws2, 'message') as Observable<MessageEvent>);
  const ws3$ = (fromEvent(ws3, 'message') as Observable<MessageEvent>);

  const ws4$ = merge(ws0$, ws1$, ws2$, ws3$).pipe(
    // tap((value) => console.log(value.data)),
    tap((value) => {
      const response: any = JSON.parse(value.data.toString());
      switch (response.channel) {
        case 'spot.tickers':
          console.log(`${response.channel} = ${response.result?.currency_pair || ''} - ${response.result?.last || ''} ${response.result?.status || ''}`);
          if (response.result?.currency_pair) {
            ws3.send(JSON.stringify({channel: 'orders', payload: { pair: response.result?.currency_pair, price: response.result?.last, amount: 1} }));
          }
          break;
        case 'orders':
          console.log(`${response.channel} = ${response.payload?.pair} ${response.payload?.price} ${response.payload?.amount}`);
          break;
        default: 
          console.log('received: %s', response);
      }
    }),
    catchError((err, caught) => {
      console.log('error: ', err)
      return caught;
    }),
  );
  ws4$.subscribe();
  
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

const handleConnection = (myWs: WebSocket): Observable<MessageEvent | CloseEvent> => {
  const onMessage$ = (fromEvent(myWs, 'message') as Observable<MessageEvent>)
    .pipe(
      map(message => JSON.parse(message.data.toString())),
      tap(messageValue => console.log('message', messageValue)),
      catchError((err, caught) => {
        console.log('error: ', err)
        return caught;
      }),
    );
  const onClose$ = (fromEvent(myWs, 'close') as Observable<CloseEvent>)
    .pipe(
      tap(closeMessage => console.log('reason', closeMessage.reason)));
  const onError$ = (fromEvent(myWs, 'error') as Observable<ErrorEvent>)
      .pipe(
        tap(errorMessage => console.log('error', errorMessage.error)));
  return merge(onMessage$, onClose$, onError$)
}