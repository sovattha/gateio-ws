import WebSocket from 'ws';
import { SpotTickerStatus, SpotTickerUpdate } from '../types/spot-ticker';

/**
 * Connect to a Gate.io websocket and subscribe to the given channel
 * @param wsUrl
 * @param channel Channel to subscribe to (for now, only 'spot.tickers')
 * @param payload Array of pairs to subscribe to
 * @returns
 */
export async function connectToWebsocket(wsUrl: string, channel: 'spot.tickers', payload?: string[]) {
  const ws = new WebSocket(wsUrl);
  return new Promise<WebSocket>((resolve, reject) => {
    if (payload) {
      ws.on('open', function open() {
        console.log('subscribing', channel, payload);
        ws.send(
          JSON.stringify({
            time: Math.round(new Date().getTime() / 1000),
            channel: channel,
            event: 'subscribe',
            payload,
          }),
        );
        console.log('subscribed', channel, payload);
        resolve(ws);
      });
    } else resolve(ws);
  });
}

/**
 * Returns a human readble ticker update
 * @param tickerUpdate
 * @returns
 */
export function formatTickerUpdate(tickerUpdate: SpotTickerUpdate | SpotTickerStatus): string {
  switch (tickerUpdate.event) {
    case 'update':
      return `${tickerUpdate.channel} = ${tickerUpdate.result?.currency_pair || ''} - ${tickerUpdate.result?.last || ''}`;
    case 'subscribe':
      return `${tickerUpdate.result?.status || ''}`;
  }
}
