import {
  catchError,
  debounceTime,
  distinctUntilChanged,
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
} from "rxjs";
import { combineLatest } from "rxjs/internal/observable/combineLatest";
import {
  formatOrder,
  getUserOrders,
  hasValidOrders,
  isValidOrder,
  updateUserOrder,
} from "./services/datastax.api";
import { createLimitOrder } from "./services/gateio.api";
import { connectToWebsocket, formatTickerUpdate } from "./services/gateio.ws";
import { UserOrder } from "./types/order";
import { SpotTickerUpdate } from "./types/spot-ticker";

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
    tap(() => console.log("ORDERS")),
    switchMap(() => getUserOrders()), // Poll user orders from Datastax
    share() // Allow to be used later without retriggering an HTTP connection to Datastax
  );
  // The order watcher is responsible of emitting the new pairs to watch
  const watcher$ = orders$.pipe(
    tap(() => console.log("WATCHER")),
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
    tap((pairs) => console.log("WATCHER found new pairs to watch", pairs))
  );
  // The ticker is responsible of emitting new quotes for the pairs that are being watched
  const ticker$ = watcher$.pipe(
    switchMap(
      (pairs) =>
        connectToWebsocket("wss://api.gateio.ws/ws/v4/", "spot.tickers", pairs) // Create a websocket connection to Gate.io and subscribe to the given pair
    ),
    switchMap(
      (websocket) => fromEvent(websocket, "message") as Observable<MessageEvent>
    ), // Wrap the newly created websocket in an observable
    map((value) => JSON.parse(value.data.toString()) as SpotTickerUpdate), // Parse the websocket response
    filter((tickerUpdate) => !!tickerUpdate.result.currency_pair),
    tap((tickerUpdate) =>
      console.log("TICKER", formatTickerUpdate(tickerUpdate))
    ), // Print out the newly received quote
    takeUntil(stopTicker$) // Stop emitting values when no user order is available
  ) as Observable<SpotTickerUpdate>;

  // Secondary streams definitions
  orders$
    .pipe(
      filter((orders) => !hasValidOrders(orders)), // When no order is present anymore
      tap(() => stopTicker$.next(true)) // Emit a value to disconnect from the ticker updates websockets
    )
    .subscribe(); // We subscribe here because we want to this observable to keep on going independently

  stopTicker$
    .pipe(
      mapTo(false), // Reset the value of the observable to false, so that new websockets connections can happen again when new user orders are present again
      tap(() => trader$.subscribe()) // Gate.io websockets will now just wait for new orders to come again
    )
    .subscribe(); // We subscribe here because we want to this observable to keep on going independently

  // The trader is responsible of taking trades when the ticker emits a price lower than the watcher's price
  const trader$ = combineLatest([orders$, ticker$]).pipe(
    tap(([orders, tickerUpdate]) =>
      console.log("TRADER orders", [
        orders.map(formatOrder),
        formatTickerUpdate(tickerUpdate),
      ])
    ),    
    debounceTime(2000), // Important: avoids duplication of limit orders when many ticker updates occur
    // distinctUntilChanged(
    //   (prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)
    // ), // Avoids duplication of order when the same limit order is emitted
    map(
      ([orders, tickerUpdate]) =>
        [orders.filter(isValidOrder), tickerUpdate] as [
          UserOrder[],
          SpotTickerUpdate
        ]
    ),
    tap(([validOrders, tickerUpdate]) =>
      console.log("TRADER valid orders", [
        validOrders.map(formatOrder),
        formatTickerUpdate(tickerUpdate),
      ])
    ),
    tap(async ([validOrders, tickerUpdate]) => {
      for (const order of validOrders) {
        if (+tickerUpdate.result.last < +order.price) {

          const updatedUserOrder = await updateUserOrder(order.id!, { ...order, fulfilled: 1 });
          console.log('updatedUserOrder',updatedUserOrder)

          console.log(`TRADER will create a limit order for ${order.id!}`);
          const orderResponse = await createLimitOrder(
            `t-${order.id!.substring(0, 20)}`,
            order.pair,
            `${order.price}`,
            `${order.amount}`
          );

          const updatedUserOrder2 = await updateUserOrder(order.id!, {
            ...order,
            orderResponse,
            orderResponseDate: new Date().toISOString(),
          });
          console.log('updatedUserOrder2',updatedUserOrder2)
        }
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
