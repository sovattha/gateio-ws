import {
  debounceTime,
  distinctUntilChanged,
  filter,
  fromEvent,
  interval,
  map,
  mapTo,
  Observable,
  Subject,
  switchMap,
  takeUntil,
  tap,
} from "rxjs";
import { combineLatest } from "rxjs/internal/observable/combineLatest";
import {
  formatOrder,
  getUserOrders,
  hasValidOrders,
  isValidOrder,
  updateUserOrder,
} from "./services/datastax.api";
import { createLimitOrder, listOpenOrders } from "./services/gateio.api";
import { connectToWebsocket, formatTickerUpdate } from "./services/gateio.ws";
import { UserOrder } from "./types/order";
import { SpotTickerStatus, SpotTickerUpdate } from "./types/spot-ticker";

/**
 * Connect to Gate.io websockets and suscribe to pairs that are on the user orders list on Datastax.
 * [Datastax user orders] -- pair --> [Gate.io websockets] -- ticker update -->
 * @returns Observable of ticker updates from Gate.io websockets
 */
async function getTickerUpdates() {
  const stopTickerUpdates$ = new Subject<boolean>();

  // Main stream definition
  const orders$ = interval(2000).pipe(
    // Every 2 seconds
    switchMap(() => getUserOrders()) // Poll user orders from Datastax
    // share() // Allow to be used later without retriggering an HTTP connection to Datastax
  );
  const orderWatcher$ = orders$.pipe(
    tap(() => console.log('WATCHER')),
    filter((pairs) => !!pairs.length), // The very first value of pair can be empty
    filter((orders) => hasValidOrders(orders)),
    map((orders) => orders.filter(isValidOrder)),
    tap((orders) =>
      console.log("WATCHER found valid orders", orders.map(formatOrder))
    ),
    map((orders) =>
      Array.from(new Set(orders.filter(isValidOrder).map(({ pair }) => pair)))
    ), // Filter unique values of pairs
    distinctUntilChanged(
      (prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)
    ), // Emit values only when the user orders change
    tap((pairs) =>
      console.log("WATCHER found new pairs to watch", pairs)
    ),
    switchMap(
      (pairs) =>
        connectToWebsocket("wss://api.gateio.ws/ws/v4/", "spot.tickers", pairs) // Create a websocket connection to Gate.io and subscribe to the given pair
    ),
    switchMap(
      (websocket) => fromEvent(websocket, "message") as Observable<MessageEvent>
    ), // Wrap the newly created websocket in an observable
    map((value) => JSON.parse(value.data.toString()) as SpotTickerUpdate | SpotTickerStatus), // Parse the websocket response
    filter((tickerUpdate) => !!tickerUpdate.result.currency_pair),
    tap((tickerUpdate) => console.log("TICKER", formatTickerUpdate(tickerUpdate))), // Print out the newly received quote
    takeUntil(stopTickerUpdates$) // Stop emitting values when no user order is available
  ) as Observable<SpotTickerUpdate>;

  // Secondary streams definitions
  orders$
    .pipe(
      filter((orders) => !hasValidOrders(orders)), // When no order is present anymore
      tap(() => stopTickerUpdates$.next(true)) // Emit a value to disconnect from the ticker updates websockets
    )
    .subscribe(); // We subscribe here because we want to this observable to keep on going independently

  stopTickerUpdates$
    .pipe(
      mapTo(false), // Reset the value of the observable to false, so that new websockets connections can happen again when new user orders are present again
      tap(() => ordersAndTickerUpdates$.subscribe()) // Gate.io websockets will now just wait for new orders to come again
    )
    .subscribe(); // We subscribe here because we want to this observable to keep on going independently

  // Order management
  const ordersAndTickerUpdates$ = combineLatest([
    orders$,
    orderWatcher$,
  ]).pipe(
    debounceTime(2000),
    distinctUntilChanged(
      (prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)
    ), // Avoids duplication of order
    tap(() => console.log('TRADER')),    
    filter(([orders]) => hasValidOrders(orders)),
    tap(([orders, tickerUpdate]) => {
      console.log(
        orders.filter(isValidOrder).map(formatOrder),
        formatTickerUpdate(tickerUpdate)
      );
    }),
    map(([orders, tickerUpdate]) => [orders.filter(isValidOrder), tickerUpdate] as [UserOrder[], SpotTickerUpdate]),
    tap(([validOrders, tickerUpdate]) => console.log('TRADER', [validOrders.map(formatOrder), formatTickerUpdate(tickerUpdate)])),
    tap(async ([validOrders, tickerUpdate]) => {
      for (const order of validOrders) {
        if (+tickerUpdate.result.last < +order.price) {
          console.log(`TRADER will create a limit order for ${order.id!}`);
          await updateUserOrder(order.id!, { ...order, fulfilled: 1 });
          await createLimitOrder(
            `t-${order.id!.substring(0, 20)}`,
            order.pair,
            order.price,
            order.amount
          );
        }
      }
    })
  );
  return ordersAndTickerUpdates$;
}

(async () => {
  const ordersAndWebsockets$ = await getTickerUpdates();
  ordersAndWebsockets$.subscribe();
})();
