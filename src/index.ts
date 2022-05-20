import { ChainId } from "@infinityxyz/lib/types/core";
import { getDb } from "./firestore";
import { OpenseaListener } from "./sale-listeners/opensea/opensea-listener";
import { SaleListenerEvent } from "./sale-listeners/sale-listener.abstract";
import { SalesHandler } from "./sales-handler";
import { getProvider } from "./utils/ethers";

async function main() {
    const mainnetProvider = getProvider(ChainId.Mainnet);

    const listeners = [new OpenseaListener(mainnetProvider)]
    const salesHandler = new SalesHandler(getDb());

    for (const listener of listeners) {

        listener.on(SaleListenerEvent.Sale, (data) => {
            console.log(JSON.stringify(data, null, 2));
            salesHandler.onSale(data);
        });
        await listener.start();
    }
}

void main();