import WebSocket from 'ws';

export async function connectToWebsocket(wsUrl: string, channel: string, payload?: any) {
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
  