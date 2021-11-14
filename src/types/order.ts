export type UserOrder = {
  id?: string;
  amount: number;
  fulfilled: number;
  orderResponse: any;
  orderResponseDate: string;
  pair: string;
  price: 100;
  side: 'buy' | 'sell';
};
