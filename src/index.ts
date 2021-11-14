import {
  distinctUntilChanged, filter, fromEvent,
  interval,
  map,
  mapTo,
  Observable, share, Subject,
  switchMap,
  takeUntil, tap
} from 'rxjs';
import { combineLatest } from 'rxjs/internal/observable/combineLatest';
import { formatOrder, getUserOrders } from './services/datastax.api';
import { connectToWebsocket, formatTickerUpdate } from './services/gateio.ws';
import { SpotTickerUpdate } from './types/spot-ticker';

/**
 * Connect to Gate.io websockets and suscribe to pairs that are on the user orders list on Datastax.
 * [Datastax user orders] -- pair --> [Gate.io websockets] -- ticker update --> 
 * @returns Observable of ticker updates from Gate.io websockets
 */
async function getTickerUpdates() {
  const stopTickerUpdates$ = new Subject<boolean>();

  // Main stream definition
  const orders$ = interval(2000).pipe( // Every 2 seconds
    switchMap(() => getUserOrders()), // Poll user orders from Datastax
    share(), // Allow to be used later without retriggering an HTTP connection to Datastax
  );
  const allTickerUpdates$ = orders$.pipe(    
    filter((orders) => !!orders.filter(order => order && (!order.fulfilled || order.fulfilled < 1)).length),
    map((orders) => Array.from(new Set(orders.map(({ pair }) => pair))) ), // Filter unique values of pairs
    distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)), // Emit values only when the user orders change
    filter(pairs => !!pairs.length), // The very first value of pair can be empty
    switchMap((pairs) =>
      connectToWebsocket('wss://api.gateio.ws/ws/v4/', 'spot.tickers', pairs) // Create a websocket connection to Gate.io and subscribe to the given pair
    ),
    switchMap((websocket) => fromEvent(websocket, 'message') as Observable<MessageEvent>), // Wrap the newly created websocket in an observable
    map((value) => JSON.parse(value.data.toString()) as SpotTickerUpdate), // Parse the websocket response
    tap((tickerUpdate) => console.log(formatTickerUpdate(tickerUpdate))), // Print out the newly received quote
    takeUntil((stopTickerUpdates$)), // Stop emitting values when no user order is available
  );

  // Secondary streams definitions
  orders$.pipe(
    filter((orders) => !orders.length), // When no order is present anymore
    tap(() => stopTickerUpdates$.next(true)), // Emit a value to disconnect from the ticker updates websockets
  ).subscribe(); // We subscribe here because we want to this observable to keep on going independently
  
  stopTickerUpdates$.pipe(
    mapTo(false), // Reset the value of the observable to false, so that new websockets connections can happen again when new user orders are present again
    tap(() => allTickerUpdates$.subscribe()), // Gate.io websockets will now just wait for new orders to come again
  ).subscribe(); // We subscribe here because we want to this observable to keep on going independently

  // Order management
  const ordersAndTickerUpdates$ = combineLatest([orders$, allTickerUpdates$]).pipe(
    tap(([orders, tickerUpdate]) => {
      console.log(orders.map(order => formatOrder(order)), formatTickerUpdate(tickerUpdate));
    })
  );
  return ordersAndTickerUpdates$;
}

(async () => {
  const ordersAndWebsockets$ = await getTickerUpdates();
  ordersAndWebsockets$.subscribe();
})();
