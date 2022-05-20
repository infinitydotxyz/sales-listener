import { firestoreConstants } from '@infinityxyz/lib/utils/constants';
import { SaleEvent } from './sale-listeners/sale-listener.abstract';
import { createHash } from 'crypto';
export class SalesHandler {
  constructor(private db: FirebaseFirestore.Firestore) {}

  public onSale(sale: SaleEvent) {
    for (const saleItem of sale.sales) {
      const collectionDocId = `${saleItem.chainId}:${saleItem.collectionAddress}`;
      const nftDocId = `${saleItem.tokenId}`;
      const collectionRef = this.db.collection(firestoreConstants.COLLECTIONS_COLL).doc(collectionDocId);
      const nftRef = collectionRef.collection(firestoreConstants.COLLECTION_NFTS_COLL).doc(nftDocId);
      const collectionSales = collectionRef.collection(`collectionSales`);
      const nftSales = nftRef.collection(`nftSales`);

      const saleItemWithFlags = {
        ...saleItem,
        flags: {
            aggregated: false,
            writtenToFeed: false
        }
      };
      const saleItemDocId: string = createHash('sha256')
        .update(`${saleItem.collectionAddress}-${saleItem.blockNumber}-${saleItem.txHash}-${saleItem.tokenId}`)
        .digest('hex');
      const saleItemCollectionDoc = collectionSales.doc(saleItemDocId);
      const saleItemNftDoc = nftSales.doc(saleItemDocId);
      this.db
        .runTransaction(async (tx) => {
          const [collectionItemSnap, nftItemSnap] = await tx.getAll(saleItemCollectionDoc, saleItemNftDoc);
          if (!collectionItemSnap.exists) {
            tx.set(saleItemCollectionDoc, saleItemWithFlags, { merge: false });
          }
          if (!nftItemSnap.exists) {
            tx.set(saleItemNftDoc, saleItemWithFlags, { merge: false });
          }
        })
        .catch(console.error);
    }
  }
}
