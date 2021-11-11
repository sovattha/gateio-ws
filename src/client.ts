import { catchError, fromEvent, map, merge, Observable, tap } from 'rxjs';
import { MessageEvent } from 'ws';
import { getOrders, listOrders, orders } from './services/datastax.api';
import { connectToWebsocket } from './services/gateio.api';

(async () => {
  await getOrders();
  const ltcUsdt = connectToWebsocket('wss://api.gateio.ws/ws/v4/', 'spot.tickers', ['LTC_USDT']);
  const ethUsdt = connectToWebsocket('wss://api.gateio.ws/ws/v4/', 'spot.tickers', ['ETH_USDT']);
  const btcUsdt = connectToWebsocket('wss://api.gateio.ws/ws/v4/', 'spot.tickers', ['BTC_USDT']);
  const ordersWs = await connectToWebsocket('ws://localhost:8080', 'orders');
  const [ltcUsdt$, ethUsdt$, btcUsdt$, ordersWs$] = await Promise.all([ltcUsdt, ethUsdt, btcUsdt, ordersWs]).then((data) => 
    Promise.all(data.map(w => fromEvent(w, 'message') as Observable<MessageEvent>))
  );

  const refreshOrders$ = ordersWs$.pipe(
    map((value) => JSON.parse(value.data.toString()) as any),
    tap(async (response) => {
      await getOrders();
      console.log(`${response.channel} = ${response.payload?.pair} ${response.payload?.price} ${response.payload?.amount}`);
    }),
  );

  const allUsdt$ = merge(ltcUsdt$, ethUsdt$, btcUsdt$).pipe(
    map((value) => JSON.parse(value.data.toString()) as any),
    tap((response) => {
      console.log(`${response.channel} = ${response.result?.currency_pair || ''} - ${response.result?.last || ''} ${response.result?.status || ''}`);
    }),
    tap(async (response) => {
      const pair = response.result?.currency_pair;
      const price = response.result?.last;
      const matchingOrders = orders.filter(order => order.pair === pair && (!order.triggered || order.triggered < 1));
      matchingOrders.map(async matchingOrder => {
        console.log(response.result?.last , matchingOrder?.price!)
        if (response.result?.last < matchingOrder?.price!) {
          const existingOrders = await listOrders(pair);
          console.log(existingOrders)
          if (!existingOrders?.length) {
            console.log('Create order', pair, price, 0.01); // TODO amount
            // createOrder(pair, price, 0.01); // TODO amount
          } else { 
            console.log('Order exists', pair);
          }
        }
      });
    }),
  );
  
  merge(refreshOrders$, allUsdt$).pipe(
    catchError((err, caught) => {
      console.log('error: ', err)
      return caught;
    }),
  ).subscribe();
  
})();  