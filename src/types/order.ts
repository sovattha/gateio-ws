export type UserOrder = {
  id?: string;
  amount: number;
  fulfilled: number;
  pair: string;
  price: 100;
};

export type GateioOrder = {
  text: string;
  currencyPair: string;
  type: 'limit';
  account: 'spot';
  side: 'buy';
  iceberg: '0';
  amount: string;
  price: string;
  timeInForce: 'gtc';
  autoBorrow: false;
};
