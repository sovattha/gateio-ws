import axios, { AxiosRequestConfig } from 'axios';

export let orders: Array<{id : string, amount: number, pair: string, price: number, triggered: number}> = [];

export async function getOrders() {
    var config: AxiosRequestConfig = {
      method: 'get',
      url: `${process.env.DATASTAX_API_URL}/collections/orders`,
      headers: { 
        'accept': 'application/json', 
        'X-Cassandra-Token': process.env.DATASTAX_API_KEY || '',
      }
    }; 
    const response = await axios(config);
    orders = Object.entries(response.data.data).map(([key, value]: [string, any]) => ({
      id: key,
      ...value,
    }));
    console.log(orders)
  }

  export async function createOrder(pair: string, price: number, amount: number) {
    var data = JSON.stringify({
      "text": "t-nextjs",
      "currencyPair": pair,
      "type": "limit",
      "account": "spot",
      "side": "buy",
      "iceberg": "0",
      "amount": amount,
      "price": price,
      "timeInForce": "gtc",
      "autoBorrow": false
    });
    
    var config: AxiosRequestConfig = {
      method: 'post',
      url: `${process.env.GATEIO_NEXTJS_API_URL}/spot/orders`,
      headers: { 
        'Authorization': process.env.GATEIO_NEXTJS_API_KEY || '',
        'Content-Type': 'application/json'
      },
      data : data
    };

    const response = await axios(config);
    return response.data.data;
  }

  export async function listOrders(pair: string) {
    var config: AxiosRequestConfig = {
      method: 'get',
      url: `${process.env.GATEIO_NEXTJS_API_URL}/spot/orders?status=open&currencyPair=${pair}`,
      headers: { 
        'Authorization': process.env.GATEIO_NEXTJS_API_KEY || ''
      }
    };

    await axios(config);
    const response = await axios(config);
    return response.data.data;
  }
  
})();  