export type SpotTickerUpdate = {
  time: number;
  channel: 'spot.tickers';
  event: 'update';
  result: {
    currency_pair: string;
    last: string;
    lowest_ask: string;
    highest_bid: string;
    change_percentage: string;
    base_volume: string;
    quote_volume: string;
    high_24h: string;
    low_24h: string;
    status?: string;
  };
};

export type SpotTickerStatus = {
  time: number;
  channel: 'spot.tickers';
  event: 'subscribe';
  result: { status: string };
};
