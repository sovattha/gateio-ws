import {
  combineLatest,
  ConnectableObservable,
  fromEvent,
  interval,
  map,
  Observable,
  switchMap,
  takeWhile,
  tap,
} from 'rxjs';
import { getOrders } from './services/datastax.api';
import { connectToWebsocket, formatTickerUpdate } from './services/gateio.ws';
import { Order } from './types/order';
import { SpotTickerUpdate } from './types/spot-ticker';

async function getOrdersAndWebsockets() {
  const orders$ = interval(2000).pipe(
    switchMap(() => getOrders()),
    map((orders: Order[]) =>
      Array.from(new Set(orders.map(({ pair }) => pair)))
    )
  );
  const allWebsockets$ = orders$.pipe(
    switchMap((pairs) =>
      connectToWebsocket('wss://api.gateio.ws/ws/v4/', 'spot.tickers', pairs)
    ),
    switchMap((w) => fromEvent(w, 'message') as Observable<MessageEvent>),
    map((value) => JSON.parse(value.data.toString()) as SpotTickerUpdate)
  );
  return combineLatest([orders$, allWebsockets$]).pipe(
    tap(([pairs, _]) => console.log(pairs)),
    tap(([_, tickerUpdate]) => console.log(formatTickerUpdate(tickerUpdate))),
    takeWhile(([pairs]) => pairs.length > 0)
  );
}

(async () => (await getOrdersAndWebsockets()).subscribe())();
