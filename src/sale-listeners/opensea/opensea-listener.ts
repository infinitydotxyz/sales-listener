import { Contract, ethers } from 'ethers';
import { convertWeiToEther, sleep, trimLowerCase } from '../../utils';
import { SaleListener, SaleListenerEvent } from '../sale-listener.abstract';
import { MERKLE_VALIDATOR_ADDRESS, WYVERN_ATOMICIZER_ADDRESS, WYVERN_EXCHANGE_ADDRESS } from './constants';
import { wyvernExchangeAbi } from './wyvern-exchange-abi';
import { Block } from '@ethersproject/abstract-provider';
import { DecodedAtomicMatchInputs, TokenInfo } from './types';
import { PreParsedNftSale, SaleSource } from '../../types';
import { ChainId, NftSale, TokenStandard } from '@infinityxyz/lib/types/core';
import { ETHEREUM_WETH_ADDRESS, NULL_ADDRESS } from '@infinityxyz/lib/utils/constants';

export class OpenseaListener extends SaleListener {
  private contract: Contract;
  private cancelListener?: () => void;

  constructor(private provider: ethers.providers.JsonRpcProvider) {
    super();
    this.contract = new ethers.Contract(WYVERN_EXCHANGE_ADDRESS, wyvernExchangeAbi, provider);
  }

  _start() {
    this.cancelListener = this.registerListener();
  }

  _stop() {
    if (this.cancelListener) {
      this.cancelListener();
      this.cancelListener = undefined;
    }
  }

  private registerListener() {
    const handler = (...args: ethers.Event[]) => {
      this.onOrdersMatched(args).catch(console.error);
    };
    this.contract.on('OrdersMatched', handler);
    return () => {
      this.contract.off('OrdersMatched', handler);
    };
  }

  private async onOrdersMatched(args: ethers.Event[]) {
    if (!args?.length || !Array.isArray(args) || !args[args.length - 1]) {
      return;
    }
    const event: ethers.Event = args[args.length - 1];
    const txHash: string = event?.transactionHash;
    if (!txHash) {
      return;
    }

    let response;
    let maxAttempts = 10;
    while (maxAttempts > 0) {
      try {
        response = await this.getTransactionByHash(txHash);
      } catch (err) {
        await sleep(2000);
        maxAttempts--;
        continue;
      }
      break;
    }
    try {
      const block: Block = await event.getBlock();
      const decodedResponse: DecodedAtomicMatchInputs = this.contract.interface.decodeFunctionData(
        'atomicMatch_',
        response as ethers.utils.BytesLike
      ) as unknown as DecodedAtomicMatchInputs;

      const saleOrders = this.handleAtomicMatch(decodedResponse, txHash, block);
      if (Array.isArray(saleOrders) && saleOrders?.length > 0) {
        console.log(`Listener:[Opensea] fetched new order successfully: ${txHash}`);
        const { sales, totalPrice } = this.parseSaleOrders(saleOrders);

        // await salesUpdater.saveTransaction({ sales, totalPrice });
        this.emit(SaleListenerEvent.Sale, { sales, totalPrice });
      }
    } catch (err) {
      console.error(`Listener:[Opensea] failed to fetch new order: ${txHash}`);
    }
  }

  private async getTransactionByHash(txHash: string): Promise<ethers.utils.BytesLike> {
    const tx = await this.provider.getTransaction(txHash);
    return tx.data;
  }

  private handleAtomicMatch(
    inputs: DecodedAtomicMatchInputs,
    txHash: string,
    block: Block
  ): PreParsedNftSale[] | undefined {
    try {
      const addrs: string[] = inputs.addrs;
      const saleAddress: string = addrs[11];

      const uints: bigint[] = inputs.uints;
      const price: bigint = uints[4];
      const buyer = addrs[1]; // Buyer.maker
      const seller = addrs[8]; // Seller.maker
      const paymentTokenErc20Address = addrs[6];

      const res: PreParsedNftSale = {
        chainId: ChainId.Mainnet,
        txHash,
        blockNumber: block.number,
        timestamp: block.timestamp * 1000,
        price,
        paymentToken: paymentTokenErc20Address,
        buyer,
        seller,
        collectionAddress: '',
        tokenId: '',
        quantity: 0,
        source: SaleSource.OpenSea,
        tokenStandard: TokenStandard.ERC721
      };

      if (saleAddress.toLowerCase() !== WYVERN_ATOMICIZER_ADDRESS) {
        const token = this.decodeSingleSale(inputs);
        res.collectionAddress = token.collectionAddr;
        res.tokenId = token.tokenIdStr;
        res.tokenStandard = token.tokenType === TokenStandard.ERC721 ? TokenStandard.ERC721 : TokenStandard.ERC1155;
        res.quantity = token.quantity;
        return [res];
      } else {
        const tokens = this.decodeBundleSale(inputs);
        const response: PreParsedNftSale[] = tokens.map((token: TokenInfo) => {
          res.collectionAddress = token.collectionAddr;
          res.tokenId = token.tokenIdStr;
          res.tokenStandard = TokenStandard.ERC721;
          res.quantity = token.quantity;
          return res;
        });
        return response;
      }
    } catch (err) {
      console.error(`Failed to parse open sales transaction: ${txHash}`);
    }
  }

  private decodeSingleSale(inputs: DecodedAtomicMatchInputs): TokenInfo {
    const TRAILING_OX = 2;
    const METHOD_ID_LENGTH = 8;
    const UINT_256_LENGTH = 64;

    const addrs = inputs.addrs;
    const nftAddrs: string = addrs[4];

    let collectionAddr;
    let tokenIdStr;
    let quantity = 1;
    let tokenType = TokenStandard.ERC721;
    const calldataBuy: string = inputs.calldataBuy;

    let offset = TRAILING_OX + METHOD_ID_LENGTH + UINT_256_LENGTH * 2;
    if (nftAddrs.toLowerCase() === MERKLE_VALIDATOR_ADDRESS) {
      collectionAddr = ethers.BigNumber.from('0x' + calldataBuy.slice(offset, offset + UINT_256_LENGTH)).toHexString();
      offset += UINT_256_LENGTH;
      tokenIdStr = ethers.BigNumber.from('0x' + calldataBuy.slice(offset, offset + UINT_256_LENGTH)).toString();
      offset += UINT_256_LENGTH;
      if (calldataBuy.length > 458) {
        quantity = ethers.BigNumber.from('0x' + calldataBuy.slice(offset, offset + UINT_256_LENGTH)).toNumber();
        tokenType = TokenStandard.ERC1155;
      }
    } else {
      // Token minted on Opensea
      collectionAddr = nftAddrs.toLowerCase();
      tokenIdStr = ethers.BigNumber.from('0x' + calldataBuy.slice(offset, offset + UINT_256_LENGTH)).toString();
      offset += UINT_256_LENGTH;
      if (calldataBuy.length > 202) {
        quantity = ethers.BigNumber.from('0x' + calldataBuy.slice(offset, offset + UINT_256_LENGTH)).toNumber();
        tokenType = TokenStandard.ERC1155;
      }
    }

    return {
      collectionAddr,
      tokenIdStr,
      quantity,
      tokenType
    };
  }

  private decodeBundleSale(inputs: DecodedAtomicMatchInputs): TokenInfo[] {
    const calldataBuy: string = inputs?.calldataBuy;
    const TRAILING_OX = 2;
    const METHOD_ID_LENGTH = 8;
    const UINT_256_LENGTH = 64;

    const indexStartNbToken = TRAILING_OX + METHOD_ID_LENGTH + UINT_256_LENGTH * 4;
    const indexStopNbToken = indexStartNbToken + UINT_256_LENGTH;

    const nbToken = ethers.BigNumber.from('0x' + calldataBuy.slice(indexStartNbToken, indexStopNbToken)).toNumber();
    const collectionAddrs: string[] = [];
    let offset = indexStopNbToken;
    for (let i = 0; i < nbToken; i++) {
      collectionAddrs.push(
        ethers.BigNumber.from('0x' + calldataBuy.slice(offset, offset + UINT_256_LENGTH)).toHexString()
      );

      // Move forward in the call data
      offset += UINT_256_LENGTH;
    }

    /**
     * After reading the contract addresses involved in the bundle sale
     * there are 2 chunks of params of length nbToken * UINT_256_LENGTH.
     *
     * Those chunks are each preceded by a "chunk metadata" of length UINT_256_LENGTH
     * Finally a last "chunk metadata" is set of length UINT_256_LENGTH. (3 META_CHUNKS)
     *
     *
     * After that we are reading the abi encoded data representing the transferFrom calls
     */
    const LEFT_CHUNKS = 2;
    const NB_META_CHUNKS = 3;
    offset += nbToken * UINT_256_LENGTH * LEFT_CHUNKS + NB_META_CHUNKS * UINT_256_LENGTH;

    const TRANSFER_FROM_DATA_LENGTH = METHOD_ID_LENGTH + UINT_256_LENGTH * 3;
    const tokenIdsList: string[] = [];
    for (let i = 0; i < nbToken; i++) {
      const transferFromData = calldataBuy.substring(offset, offset + TRANSFER_FROM_DATA_LENGTH);
      const tokenIdstr = ethers.BigNumber.from(
        '0x' + transferFromData.substring(METHOD_ID_LENGTH + UINT_256_LENGTH * 2)
      ).toString();
      tokenIdsList.push(tokenIdstr);

      // Move forward in the call data
      offset += TRANSFER_FROM_DATA_LENGTH;
    }

    return collectionAddrs.map((val, index) => ({
      collectionAddr: collectionAddrs[index],
      tokenIdStr: tokenIdsList[index],
      quantity: 1,
      tokenType: TokenStandard.ERC721
    }));
  }

  private parseSaleOrders = (sales: PreParsedNftSale[]): { sales: NftSale[]; totalPrice: number } => {
    /**
     * Skip the transactions without eth or weth as the payment. ex: usd, matic ...
     * */
    if (
      sales[0].paymentToken !== NULL_ADDRESS &&
      trimLowerCase(sales[0].paymentToken) !== trimLowerCase(ETHEREUM_WETH_ADDRESS)
    ) {
      return { sales: [], totalPrice: 0 };
    }

    try {
      const totalPrice = convertWeiToEther(sales[0].price);
      const orders: NftSale[] = sales.map((tx: PreParsedNftSale) => {
        const order: NftSale = {
          chainId: tx.chainId,
          tokenStandard: tx.tokenStandard,
          txHash: trimLowerCase(tx.txHash),
          tokenId: tx.tokenId,
          collectionAddress: trimLowerCase(tx.collectionAddress),
          price: totalPrice / sales.length / tx.quantity,
          paymentToken: tx.paymentToken,
          quantity: tx.quantity,
          buyer: trimLowerCase(tx.buyer),
          seller: trimLowerCase(tx.seller),
          source: tx.source,
          blockNumber: tx.blockNumber,
          timestamp: tx.timestamp
        };
        return order;
      });

      return { sales: orders, totalPrice };
    } catch (err) {
      console.error('Failed parsing orders', err);
      return { sales: [], totalPrice: 0 };
    }
  };
}
