import {
  combineLatest, fromEvent,
  interval,
  map,
  Observable,
  of,
  switchMap,
  takeWhile,
  tap
} from 'rxjs';
import { getUserOrders } from './services/datastax.api';
import { connectToWebsocket, formatTickerUpdate } from './services/gateio.ws';
import { SpotTickerUpdate } from './types/spot-ticker';

async function getOrdersAndWebsockets() {
  const orders$ = of([]).pipe(
    switchMap(() => getUserOrders()),
    map((orders) =>
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
