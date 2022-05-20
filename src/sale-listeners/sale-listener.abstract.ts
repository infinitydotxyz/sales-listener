import { NftSale } from "@infinityxyz/lib/types/core";
import EventEmitter from "events";

export enum SaleListenerEvent {
    Sale = 'sale',
}

export interface SaleEvent {
    sales: NftSale[];

    totalPrice: number;
}

export type SaleEventType = {
    [SaleListenerEvent.Sale]: SaleEvent,
}

export abstract class SaleListener {
    protected _eventEmitter: EventEmitter;
    private isRunningMutex = false;
    constructor() {
        this._eventEmitter = new EventEmitter();    
    }
    
    async start() {
        if(this.isRunningMutex) {
            return;
        }
        this.isRunningMutex = true;
        await this._start();
    }

    async stop() {
        if(!this.isRunningMutex) {
            return;
        }
        this.isRunningMutex = false;
        await this.stop();
    }

    protected abstract _start(): Promise<void> | void;

    protected abstract _stop(): Promise<void> | void;
    
    on<Event extends SaleListenerEvent>(event: Event, handler: (data: SaleEventType[Event]) => void): () => void {
        this._eventEmitter.on(event, handler);
        return () => {
            this._eventEmitter.off(event, handler);
        }
    }

    protected emit<Event extends SaleListenerEvent>(event: Event, data: SaleEventType[Event]): void {
        this._eventEmitter.emit(event, data);
    }
}