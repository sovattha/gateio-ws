export type UserOrder = GateioOrder & {
    fulfilled?: number;
};

export type GateioOrder = {
    id: string,
    amount: number,
    pair: string,
    price: number,
}
