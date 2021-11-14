import axios, { AxiosRequestConfig } from 'axios';
import { GateioOrder } from '../types/order';

/**
 * Create a limit order
 * @param text
 * @param pair
 * @param price
 * @param amount
 * @returns
 */
export async function createLimitOrder(
  text: string,
  pair: string,
  price: number,
  amount: number
) {
  var data = JSON.stringify({
    text,
    currencyPair: pair,
    type: 'limit',
    account: 'spot',
    side: 'buy',
    iceberg: '0',
    amount,
    price,
    timeInForce: 'gtc',
    autoBorrow: false,
  });

  var config: AxiosRequestConfig = {
    method: 'post',
    url: `${process.env.GATEIO_NEXTJS_API_URL}/spot/orders`,
    headers: {
      Authorization: process.env.GATEIO_NEXTJS_API_KEY || '',
      'Content-Type': 'application/json',
    },
    data,
  };

  try {
    console.log('Creating order', text, pair, price, amount);
    const response = await axios(config);
    console.log('Created order', response.data);
    return response.data.data;
  } catch (error: any) {
    console.error(error?.response?.data);
    return [];
  }
}

/**
 * List all the open orders for a given pair
 * @param pair
 * @returns
 */
export async function listOpenOrders(pair: string) {
  var config: AxiosRequestConfig = {
    method: 'get',
    url: `${process.env.GATEIO_NEXTJS_API_URL}/spot/orders?status=open&currencyPair=${pair}`,
    headers: {
      Authorization: process.env.GATEIO_NEXTJS_API_KEY || '',
    },
  };
  const response = await axios(config);
  return response.data as GateioOrder[];
}
