import { ethers } from "ethers";

export function sleep(duration: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, duration));
}

export function trimLowerCase(str: string) {
  return str?.trim()?.toLowerCase?.() ?? '';
}


export const convertWeiToEther = (price: bigint): number => {
  return parseFloat(ethers.utils.formatEther(price.toString()));
};