export type UserOrder = GateioOrder & {
    triggered?: number;
};

export type GateioOrder = {
    id: string,
    amount: number,
    pair: string,
    price: number,
}
