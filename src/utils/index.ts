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

export function getEnvVariable(name: string, required: false, defaultValue?: string): string | undefined;
export function getEnvVariable(name: string, required: true, defaultValue?: string): string;
export function getEnvVariable(name: string, required: boolean, defaultValue?: string) {
  const value = process.env[name] ?? defaultValue;

  if (value) {
    return value;
  }

  if (required) {
    throw new Error(`Failed to find environment variable: ${name}`);
  }
}
