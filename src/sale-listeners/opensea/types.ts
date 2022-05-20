export type DecodedAtomicMatchInputs = {
  calldataBuy: string;
  addrs: string[];
  uints: bigint[];
};


export interface TokenInfo {
  collectionAddr: string;
  tokenIdStr: string;
  quantity: number;
  tokenType: string;
}
