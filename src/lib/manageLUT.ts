import {
  MPL_BUBBLEGUM_PROGRAM_ID,
  SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
  SPL_NOOP_PROGRAM_ID,
} from '@metaplex-foundation/mpl-bubblegum';
import { MPL_TOKEN_METADATA_PROGRAM_ID } from '@metaplex-foundation/mpl-token-metadata';
import {
  createEmptyLut,
  createLut,
  extendLut,
  findAddressLookupTablePda,
} from '@metaplex-foundation/mpl-toolbox';
import {
  createSignerFromKeypair,
  publicKey,
  signerIdentity,
} from '@metaplex-foundation/umi';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { clusterApiUrl } from '@solana/web3.js';
import * as bs58 from 'bs58';

/**
 * Create a Lookup Table (LUT)
 * @param keyPair - Keypair to use for creating the LUT
 * @param rpcUrl - RPC URL to use for creating the LUT
 * @returns LUT address and transaction signature
 */
export async function createLUT(keyPair: string | Uint8Array, rpcUrl?: string) {
  const umi = createUmi(rpcUrl || clusterApiUrl('devnet'));
  //check if keypair is string, if so convert to Uint8Array
  const keypair = typeof keyPair === 'string' ? bs58.decode(keyPair) : keyPair;
  const umiKeypair = umi.eddsa.createKeypairFromSecretKey(keypair);
  const signer = createSignerFromKeypair({ eddsa: umi.eddsa }, umiKeypair);
  umi.use(signerIdentity(signer));
  const slot = await umi.rpc.getSlot();
  const res = await createEmptyLut(umi, {
    recentSlot: slot,
    authority: signer,
  }).sendAndConfirm(umi);
  const lutAddress = findAddressLookupTablePda(umi, {
    authority: signer.publicKey,
    recentSlot: slot,
  });
  return {
    lutAddress: lutAddress,
    transactionSignature: res,
    slot: slot,
  };
}
/**
 * Create a Lookup Table (LUT) with addresses
 * @param keyPair - Keypair to use for creating the LUT
 * @param addresses - Addresses to add to the LUT
 * @param rpcUrl - RPC URL to use for creating the LUT
 * @returns LUT address and transaction signature
 */
export async function createLUTWithAddresses(
  keyPair: string | Uint8Array,
  addresses: string[],
  rpcUrl?: string,
) {
  const umi = createUmi(rpcUrl || clusterApiUrl('devnet'));
  //check if keypair is string, if so convert to Uint8Array
  const keypair = typeof keyPair === 'string' ? bs58.decode(keyPair) : keyPair;
  const umiKeypair = umi.eddsa.createKeypairFromSecretKey(keypair);
  const signer = createSignerFromKeypair({ eddsa: umi.eddsa }, umiKeypair);
  umi.use(signerIdentity(signer));
  const mappedAddresses = addresses.map((address) => {
    return publicKey(address);
  });
  const slot = await umi.rpc.getSlot();
  const [builder, _] = createLut(umi, {
    recentSlot: slot,
    authority: signer,
    addresses: mappedAddresses,
  });
  const res = await builder.sendAndConfirm(umi);
  const lutAddress = findAddressLookupTablePda(umi, {
    authority: signer.publicKey,
    recentSlot: slot,
  });
  return {
    lutAddress: lutAddress,
    transactionSignature: res,
    slot: slot,
  };
}
/**
 * Create a Lookup Table (LUT) using common cNFT addresses
 * @param keyPair - Keypair to use for creating the LUT
 * @param rpcUrl - RPC URL to use for creating the LUT
 * @returns LUT address and transaction signature
 */
export async function createCnftLUT(
  keyPair: string | Uint8Array,
  rpcUrl?: string,
) {
  const addresses = [
    SPL_NOOP_PROGRAM_ID,
    MPL_BUBBLEGUM_PROGRAM_ID,
    SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
    MPL_TOKEN_METADATA_PROGRAM_ID,
  ];
  return createLUTWithAddresses(keyPair, addresses, rpcUrl);
}

/**
 * Extend an existing Lookup Table (LUT)
 * @param keyPair - Keypair to use for extending the LUT
 * @param addresses - Addresses to add to the LUT
 * @param rpcUrl - RPC URL to use for extending the LUT
 * @param lut - Lut address if existing will use that to extend
 * @param slot - slot, if existing will use that to look up the lut and extend.
 * @returns lutAddress
 */
export async function extendLUT(
  keyPair: string | Uint8Array,
  addresses: string[],
  rpcUrl?: string,
  lut?: string,
  slot?: number,
) {
  const umi = createUmi(rpcUrl || clusterApiUrl('devnet'));
  //check if keypair is string, if so convert to Uint8Array
  const keypair = typeof keyPair === 'string' ? bs58.decode(keyPair) : keyPair;
  const umiKeypair = umi.eddsa.createKeypairFromSecretKey(keypair);
  const signer = createSignerFromKeypair({ eddsa: umi.eddsa }, umiKeypair);
  umi.use(signerIdentity(signer));
  const mappedAddresses = addresses.map((address) => {
    return publicKey(address);
  });
  //if not lut provided use slot to get it only if its provided as well throw error if neither are provided
  if (!lut && !slot) {
    throw new Error('You must provide either the lut or the slot');
  }
  let finalLut = '';
  if (!lut && slot) {
    const lutAddress = findAddressLookupTablePda(umi, {
      authority: signer.publicKey,
      recentSlot: slot,
    });
    finalLut = lutAddress.toString();
  }
  if (lut && !slot) {
    finalLut = lut;
  }
  await extendLut(umi, {
    authority: signer,
    address: publicKey(finalLut),
    addresses: mappedAddresses,
  }).sendAndConfirm(umi);
  return {
    lutAddress: finalLut,
  };
}
