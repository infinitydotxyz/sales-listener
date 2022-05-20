import { NftSale, TokenStandard } from '@infinityxyz/lib/types/core';
import { Stats } from '@infinityxyz/lib/types/core';

export enum SaleSource {
  OpenSea = 'OPENSEA',
  Infinity = 'INFINITY'
}

export interface PreParsedNftSale {
  chainId: string;
  txHash: string;
  blockNumber: number;
  timestamp: number;
  collectionAddress: string;
  tokenId: string;
  price: bigint;
  paymentToken: string;
  buyer: string;
  seller: string;
  quantity: number;
  source: SaleSource;
  tokenStandard: TokenStandard;
}


export type PreAggregationStats = Pick<
  Stats,
  | 'avgPrice'
  | 'ceilPrice'
  | 'chainId'
  | 'collectionAddress'
  | 'floorPrice'
  | 'numSales'
  | 'tokenId'
  | 'volume'
  | 'updatedAt'
>;


/**
 * represents an ethereum transaction containing sales of one or more nfts
 */
 export type TransactionType = { sales: NftSale[]; totalPrice: number };