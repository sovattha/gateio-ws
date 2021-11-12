import axios, { AxiosRequestConfig } from 'axios';

export let orders: Array<{
  id: string;
  amount: number;
  pair: string;
  price: number;
  triggered: number;
}> = [];

export async function getOrders() {
  var config: AxiosRequestConfig = {
    method: 'get',
    url: `${process.env.DATASTAX_API_URL}/collections/orders?page-size=20`,
    headers: {
      accept: 'application/json',
      'X-Cassandra-Token': process.env.DATASTAX_API_KEY || '',
    },
  };
  try {
    const response = await axios(config);
    orders = Object.entries(response.data.data).map(
      ([key, value]: [string, any]) => ({
        id: key,
        ...value,
      })
    );
    console.log(orders);
    return orders;
  } catch (error) {
    return [];
  }
}
