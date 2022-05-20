import { ChainId } from '@infinityxyz/lib/types/core';
import { getDb } from './firestore';
import { OpenseaListener } from './sale-listeners/opensea/opensea-listener';
import { SaleListenerEvent } from './sale-listeners/sale-listener.abstract';
import { SalesHandler } from './sales-handler';
import { getProvider } from './utils/ethers';

async function main() {
  const mainnetProvider = getProvider(ChainId.Mainnet);

  const listeners = [new OpenseaListener(mainnetProvider)];
  const salesHandler = new SalesHandler(getDb());

  for (const listener of listeners) {
    listener.on(SaleListenerEvent.Sale, (data) => {
      salesHandler.onSale(data);
        // console.log(data);
    });
    await listener.start();
  }
}

async function historicalSales() {
  const mainnetProvider = getProvider(ChainId.Mainnet);

  const opensea = new OpenseaListener(mainnetProvider);
  const salesHandler = new SalesHandler(getDb());

  opensea.on(SaleListenerEvent.Sale, (data) => {
    // salesHandler.onSale(data);
    console.log(data.sales)
  });

  await opensea.startHistorical();
}

// void main();
void historicalSales();
