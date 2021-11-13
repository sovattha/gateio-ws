import {
  buffer,
  bufferCount,
  combineLatest, distinct, distinctUntilChanged, filter, fromEvent,
  interval,
  map,
  Observable, Subject,
  switchMap,
  takeUntil, takeWhile, tap, throttle, throttleTime, withLatestFrom
} from 'rxjs';
import { getUserOrders } from './services/datastax.api';
import { connectToWebsocket, formatTickerUpdate } from './services/gateio.ws';
import { SpotTickerUpdate } from './types/spot-ticker';

async function getOrdersAndWebsockets() {
  const orders$ = interval(2000).pipe(
    tap(console.log),
    switchMap(() => getUserOrders()),
    map((orders) => Array.from(new Set(orders.map(({ pair }) => pair))) ),
    distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)),
  );
  interval(2000).pipe(
    withLatestFrom(orders$),
    filter(([_, orders]) => orders.length === 0),
    tap(() => stopTickerUpdates$.next(true)),
  );
  const stopTickerUpdates$ = new Subject<boolean>();
  const allTickerUpdates$ = orders$.pipe(
    switchMap((pairs) =>
      connectToWebsocket('wss://api.gateio.ws/ws/v4/', 'spot.tickers', pairs)
    ),
    switchMap((w) => fromEvent(w, 'message') as Observable<MessageEvent>),
    map((value) => JSON.parse(value.data.toString()) as SpotTickerUpdate)
  );
  const ordersAndWebsockets$ = combineLatest([orders$, allTickerUpdates$]).pipe(
    tap(([pairs, _]) => console.log('pairs', pairs)),
    tap(([_, tickerUpdate]) => console.log('ticker update', formatTickerUpdate(tickerUpdate))),
    takeUntil(stopTickerUpdates$)
  );
  return ordersAndWebsockets$;
}

(async () => {
  const ordersAndWebsockets$ = await getOrdersAndWebsockets()
  ordersAndWebsockets$.subscribe();
})();
