import axios, { AxiosRequestConfig } from 'axios';
import { UserOrder } from '../types/order';

/**
 * Fetch the user orders from Datastax.
 * @returns 
 */
export async function getUserOrders() {
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
    const orders = Object.entries(response.data.data).map(
      ([key, value]: [string, any]) => ({
        id: key,
        ...value,
      })
    );
    return orders as UserOrder[];
  } catch (error: any) {
    console.error(error?.response?.data);
    return [];
  }
}
