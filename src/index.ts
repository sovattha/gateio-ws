import {
  catchError,
  distinctUntilChanged,
  distinctUntilKeyChanged,
  filter,
  fromEvent,
  interval,
  map,
  mapTo,
  Observable,
  of,
  share,
  Subject,
  switchMap,
  takeUntil,
  tap,
  throttleTime,
} from 'rxjs';
import { combineLatest } from 'rxjs/internal/observable/combineLatest';
import { formatOrder, getUserOrders, hasValidOrders, isValidOrder, updateUserOrder } from './services/datastax.api';
import { createLimitOrder } from './services/gateio.api';
import { connectToWebsocket, formatTickerUpdate } from './services/gateio.ws';
import { UserOrder } from './types/order';
import { SpotTickerUpdate } from './types/spot-ticker';

/**
 * Fetch user orders, then connect to the corresponding Gate.io websockets
 * and suscribe to pairs that are on the user orders list on Datastax.
 *
 * Ultimately take the trades when the price is reached for a given pair.
 *
 * [Datastax user orders (ORDERS/WATCHER)] --(pair)--> [Gate.io websockets (TICKER)] --(ticker update)--> [Order management (TRADER)]
 * @returns Observable of ticker updates from Gate.io websockets
 */
async function getTrader$() {
  const stopTicker$ = new Subject<boolean>();

  // Main stream definition
  const orders$ = interval(2000).pipe(
    // Every 2 seconds
    switchMap(() => getUserOrders()), // Poll user orders from Datastax
    distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)),
    tap(() => console.log('ORDERS')),
    share(), // Allow to be used later without retriggering an HTTP connection to Datastax
  );

  // The order watcher is responsible of emitting the new pairs to watch
  const watcher$ = orders$.pipe(
    distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)),
    tap(() => console.log('WATCHER')),
    filter((pairs) => !!pairs.length), // The very first value of pair can be empty
    map((orders) => orders.filter(isValidOrder)),
    tap((orders) => console.log('WATCHER found valid orders', orders.map(formatOrder))),
    map((orders) => Array.from(new Set(orders.filter(isValidOrder).map(({ pair }) => pair)))), // Filter unique values of pairs
    distinctUntilKeyChanged('length'), // Emit values only when the watchlist changes
    tap((pairs) => console.log('WATCHER found new pairs to watch', pairs)),
  );

  // The ticker is responsible of emitting new quotes for the pairs that are being watched
  const ticker$ = watcher$.pipe(
    switchMap(
      (pairs) => connectToWebsocket('wss://api.gateio.ws/ws/v4/', 'spot.tickers', pairs), // Create a websocket connection to Gate.io and subscribe to the given pair
    ),
    switchMap((websocket) => fromEvent(websocket, 'message') as Observable<MessageEvent>), // Wrap the newly created websocket in an observable
    map((value) => JSON.parse(value.data.toString()) as SpotTickerUpdate), // Parse the websocket response
    filter((tickerUpdate) => !!tickerUpdate.result.currency_pair),
    distinctUntilChanged((prev, curr) => prev.result.last === curr.result.last),
    tap((tickerUpdate) => console.log('TICKER', formatTickerUpdate(tickerUpdate))), // Print out the newly received quote
    takeUntil(stopTicker$), // Stop emitting values when no user order is available
  ) as Observable<SpotTickerUpdate>;

  // Secondary streams definitions
  orders$
    .pipe(
      filter((orders) => !hasValidOrders(orders)), // When no order is present anymore
      tap(() => stopTicker$.next(true)), // Emit a value to disconnect from the ticker updates websockets
    )
    .subscribe(); // We subscribe here because we want to this observable to keep on going independently

  stopTicker$
    .pipe(
      mapTo(false), // Reset the value of the observable to false, so that new websockets connections can happen again when new user orders are present again
      tap(() => trader$.subscribe()), // Gate.io websockets will now just wait for new orders to come again
    )
    .subscribe(); // We subscribe here because we want to this observable to keep on going independently

  // The trader is responsible of taking trades when the ticker emits a price lower than the watcher's price
  const trader$ = combineLatest([orders$, ticker$]).pipe(
    distinctUntilChanged((prev, curr) => getPriceTuple(prev) === getPriceTuple(curr)), // Avoids duplication of order when the same limit order is emitted
    map(([orders, tickerUpdate]) => [orders.filter(isValidOrder), tickerUpdate] as [UserOrder[], SpotTickerUpdate]),
    tap(([validOrders, tickerUpdate]) =>
      console.log('TRADER valid orders', [
        validOrders
          .sort((o1, o2) => o1.pair.localeCompare(o2.pair) || o1.price - o2.price || o1.side.localeCompare(o2.side)) // Sort by pair, then price, then side
          .map(formatOrder),
        formatTickerUpdate(tickerUpdate),
      ]),
    ),
    map(([validOrders, tickerUpdate]) =>
      validOrders.filter(
        (order) =>
          tickerUpdate.result.currency_pair === order.pair &&
          ((order.side === 'buy' && +tickerUpdate.result.last < +order.price) ||
            (order.side === 'sell' && +tickerUpdate.result.last > +order.price)),
      ),
    ),
    throttleTime(2000), // Important: avoids duplication of limit orders if too many ticker updates occur
    tap(async (validOrders) => {
      for (const order of validOrders) {
        await triggerTrade(order);
      }
    }),
    catchError((error) => {
      console.error(error);
      return of(undefined);
    }),
  );
  return trader$;
}

(async () => {
  const trader$ = await getTrader$();
  trader$.subscribe();
})();

function getPriceTuple(tuple: [UserOrder[], SpotTickerUpdate]) {
  return `${tuple[0].map((userOrder) => userOrder.price).join(' ')} ${tuple[1].result.last}`;
}

/**
 * Trigger the given trade
 * TODO this can be done in a subject with a distinctUntilChanged + throttleTime to avoid duplication of orders
 * @param userOrder
 */
async function triggerTrade(order: UserOrder) {
  await updateUserOrder(order.id!, {
    ...order,
    fulfilled: 1,
  });

  console.log(`TRADER will create a limit order for ${order.id!}`);
  const orderResponse = await createLimitOrder(
    `t-${order.id!.substring(0, 20)}`,
    order.pair,
    `${order.price}`,
    `${order.amount}`,
    `${order.side}`,
  );

  await updateUserOrder(order.id!, {
    ...order,
    fulfilled: 1,
    orderResponse,
    orderResponseDate: new Date().toISOString(),
  });
}
