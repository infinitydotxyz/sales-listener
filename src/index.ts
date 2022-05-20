import { ChainId } from "@infinityxyz/lib/types/core";
import { OpenseaListener } from "./sale-listeners/opensea/opensea-listener";
import { SaleListenerEvent } from "./sale-listeners/sale-listener.abstract";
import { getProvider } from "./utils/ethers";

async function main() {
    const mainnetProvider = getProvider(ChainId.Mainnet);

    const listeners = [new OpenseaListener(mainnetProvider)]


    for (const listener of listeners) {

        listener.on(SaleListenerEvent.Sale, (data) => {
            console.log(JSON.stringify(data, null, 2));
        })
        await listener.start();
    }

}

void main();