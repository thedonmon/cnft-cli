import { Keypair } from '@solana/web3.js';
import BigNumber from 'bignumber.js';
import { BN } from '@project-serum/anchor';
import * as bs58 from 'bs58';
import * as fs from 'fs';
import ora from 'ora';
export function extractSecret(keyPair: string | Uint8Array) {
  return typeof keyPair === 'string' ? bs58.decode(keyPair) : keyPair;
}

export function writeToFile(
  data: any,
  path: string,
  providedOptions: { jsonFormat?: boolean; writeToFile?: boolean } = {},
) {
  const defaultOptions = {
    jsonFormat: true,
    writeToFile: true,
  };

  // Merge provided options with default options
  const options = { ...defaultOptions, ...providedOptions };
  const dir = './out';
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
  if (!options.writeToFile) {
    return;
  }
  const dataToWrite = options.jsonFormat ? JSON.stringify(data, null, 2) : data;
  fs.writeFileSync(`${dir}/${path}`, dataToWrite);
  ora(`Data saved to ${dir}/${path}`).succeed();
}

export const toBuffer = (arr: Buffer | Uint8Array | number[]): Buffer => {
  if (Buffer.isBuffer(arr)) {
    return arr;
  } else if (arr instanceof Uint8Array) {
    return Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
  } else {
    return Buffer.from(arr);
  }
};

export function loadWalletKey(
  keypair: string | number[],
  isFile = true,
): Keypair {
  if (!keypair || keypair == '') {
    throw new Error('Keypair is required!');
  }
  if (typeof keypair === 'string') {
    if (!fs.existsSync(keypair) && isFile) {
      throw new Error(`Keypair file not found at: ${keypair}`);
    }
    const loaded = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(fs.readFileSync(keypair).toString())),
    );
    console.info(`Loaded keypair public key: ${loaded.publicKey}`);
    return loaded;
  } else {
    const loaded = Keypair.fromSecretKey(new Uint8Array(keypair));
    console.info(`Loaded keypair public key: ${loaded.publicKey}`);
    return loaded;
  }
}

export function toBigNumber(amount: number | BN): BigNumber {
  let amt: BigNumber;
  if (amount instanceof BigNumber) {
    amt = amount;
  } else {
    amt = new BigNumber(amount.toString());
  }
  return amt;
}

/**
 * Converts a UI representation of a token amount into its native value as `BN`, given the specified mint decimal amount (default to 6 for USDC).
 */
export function uiToNative(amount: number | BN, decimals: number): BN {
  const amt = toBigNumber(amount);
  return new BN(amt.times(10 ** decimals).toFixed(0, BigNumber.ROUND_FLOOR));
}

/**
 * Converts a native representation of a token amount into its UI value as `number`, given the specified mint decimal amount (default to 6 for USDC).
 */
export function nativeToUiNumber(
  amount: number | BN,
  decimals: number,
): number {
  const amt = toBigNumber(amount);
  return amt.div(10 ** decimals).toNumber();
}

export function estimateTransactionSize(
  serializedTxn: Uint8Array,
  signaturesLength: number,
): number {
  const size = serializedTxn.length + 1 + signaturesLength * 64;
  return size;
}
