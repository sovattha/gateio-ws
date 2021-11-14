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
    const orders = Object.entries(response.data.data).map(([key, value]: [string, any]) => ({
      id: key,
      ...value,
    }));
    return orders as UserOrder[];
  } catch (error: any) {
    console.error(error?.response?.data);
    return [];
  }
}

/**
 * Update a user order from Datastax.
 * @returns
 */
export async function updateUserOrder(orderId: string, data: UserOrder) {
  var config: AxiosRequestConfig = {
    method: 'put',
    url: `${process.env.DATASTAX_API_URL}/collections/orders/${orderId}`,
    headers: {
      accept: 'application/json',
      'X-Cassandra-Token': process.env.DATASTAX_API_KEY || '',
      'Content-Type': 'application/json',
    },
    data,
  };
  try {
    console.log('Update user order', orderId, data);
    const response = await axios(config);
    console.log('Datastax response', response.status, response.statusText, response.data);
    return response.data;
  } catch (error: any) {
    console.error(error);
    return [];
  }
}

export function formatOrder(order: UserOrder): string {
  return `${order.side} ${order.amount} ${order.pair} @ ${order.price} (${order.fulfilled || 0})`;
}

export function hasValidOrders(orders: UserOrder[]): boolean {
  return !!orders.filter(isValidOrder).length;
}

export function isValidOrder(order: UserOrder): boolean {
  return order && (!order.fulfilled || order.fulfilled < 1);
}
