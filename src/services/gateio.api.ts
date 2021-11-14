import { ApiClient, Order, SpotApi } from 'gate-api';

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
  price: string,
  amount: string,
) {
  var data: Order = {
    text,
    currencyPair: pair,
    type: Order.Type.Limit,
    account: Order.Account.Spot,
    side: Order.Side.Buy,
    iceberg: '0',
    amount,
    price,
    timeInForce: Order.TimeInForce.Gtc,
    autoBorrow: false,
  };

  try {
    console.log('GATEIO API Creating order', text, pair, price, amount);
    const response = await createOrder(data);
    console.log('Created order', response);
    return response;
    // const response = await axios(config);
    // console.log('Created order', response.data);
    // return response.data.data;
  } catch (error: any) {
    console.error(error?.response?.data);
    return error?.response?.data;
  }
}

/**
 * Get an instance of the Gate.io Spot API client
 * @param key 
 * @param secret 
 * @returns 
 */
export function getSpotApi(key?: string, secret?: string) {
  const client = new ApiClient();
  if (key && secret)
    client.setApiKeySecret(key, secret);
  return new SpotApi(client);
}

/**
 * Send the given order to the spot API
 * @param order 
 * @returns 
 */
async function createOrder(order: Order) {
  const authorization = process.env.GATEIO_API_KEY || '';
  const [key, secret] = authorization.split(':');
  const value = await getSpotApi(key, secret).createOrder(order);
  return value;
}