import { mplBubblegum, createTree } from '@metaplex-foundation/mpl-bubblegum';
import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import {
  createSignerFromKeypair,
  signerIdentity,
  generateSigner,
} from '@metaplex-foundation/umi';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { clusterApiUrl } from '@solana/web3.js';
import { extractSecret } from './helpers';
import { extendLUT } from './manageLUT';
import * as bs58 from 'bs58';
import {
  setComputeUnitLimit,
  setComputeUnitPrice,
} from '@metaplex-foundation/mpl-toolbox';

/**
 * Create merkle tree for cNFTs
 * @param keyPair - Keypair to use for creating the merkle tree
 * @param rpcUrl - RPC URL to use for creating the merkle tree
 * @param lutAddress - Address of the LUT to extend with the merkle tree
 * @param maxDepth - Maximum depth of the merkle tree
 * @param maxBufferSize - Maximum buffer size of the merkle tree
 * @returns Signature string and merkle tree address
 */
export async function createMerkleTree(
  keyPair: string | Uint8Array,
  rpcUrl?: string,
  lutAddress?: string,
  maxDepth: number = 14,
  maxBufferSize: number = 64,
  canopyDepth?: number,
  computeUnitPrice?: number,
) {
  const umi = createUmi(rpcUrl || clusterApiUrl('devnet'))
    .use(mplTokenMetadata())
    .use(mplBubblegum());
  const secretKey = extractSecret(keyPair);
  const umiKeypair = umi.eddsa.createKeypairFromSecretKey(secretKey);
  const signer = createSignerFromKeypair({ eddsa: umi.eddsa }, umiKeypair);
  umi.use(signerIdentity(signer));

  const merkleTree = generateSigner(umi);
  let builder = await createTree(umi, {
    merkleTree,
    maxDepth: maxDepth,
    maxBufferSize: maxBufferSize,
    canopyDepth: canopyDepth,
  });
  builder = builder.add(
    setComputeUnitLimit(umi, {
      units: 200_000,
    }),
  );

  if (computeUnitPrice) {
    builder = builder.add(
      setComputeUnitPrice(umi, {
        microLamports: computeUnitPrice,
      }),
    );
  }

  const res = await builder.sendAndConfirm(umi, {
    send: {
      skipPreflight: true,
    },
  });
  console.log('Merkle tree created: ', merkleTree.publicKey.toString());
  if (lutAddress) {
    await extendLUT(
      secretKey,
      [merkleTree.publicKey.toString()],
      rpcUrl,
      lutAddress,
    );
    console.log('LUT extended with merkle tree');
  }
  return {
    merkleTreeAddress: merkleTree.publicKey.toString(),
    signature: bs58.encode(res.signature),
  };
}
