export interface IPendingTransaction {
  blockHash: string | null;
  blockNumber: number | null;
  chainId: number;
  condition: string | null;
  creates: string | null;
  from: string;
  gas: string;
  gasPrice: string;
  hash: string;
  input: string;
  nonce: string;
  publicKey: string;
  r: string;
  raw: string;
  s: string;
  standardV: string;
  to: string;
  transactionIndex: number;
  v: string;
  value: string;
}

