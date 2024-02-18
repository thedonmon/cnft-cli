import { mplBubblegum, createTree } from '@metaplex-foundation/mpl-bubblegum';
import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import {
  createSignerFromKeypair,
  signerIdentity,
  generateSigner,
} from '@metaplex-foundation/umi';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { nftStorageUploader } from '@metaplex-foundation/umi-uploader-nft-storage';
import { clusterApiUrl } from '@solana/web3.js';
import { extractSecret } from './helpers';
import { extendLUT } from './manageLUT';
import * as bs58 from 'bs58';

export async function createMerkleTree(
  keyPair: string | Uint8Array,
  rpcUrl?: string,
  lutAddress?: string,
  maxDepth: number = 14,
  maxBufferSize: number = 64,
) {
  if (!process.env.NFT_STORAGE_API_KEY) {
    throw new Error('NFT_STORAGE_API_KEY is not set');
  }
  const umi = createUmi(rpcUrl || clusterApiUrl('devnet'))
    .use(mplTokenMetadata())
    .use(nftStorageUploader({ token: process.env.NFT_STORAGE_API_KEY }))
    .use(mplBubblegum());
  const secretKey = extractSecret(keyPair);
  const umiKeypair = umi.eddsa.createKeypairFromSecretKey(secretKey);
  const signer = createSignerFromKeypair({ eddsa: umi.eddsa }, umiKeypair);
  umi.use(signerIdentity(signer));

  const merkleTree = generateSigner(umi);
  const builder = await createTree(umi, {
    merkleTree,
    maxDepth: maxDepth,
    maxBufferSize: maxBufferSize,
  });
  const res = await builder.sendAndConfirm(umi);
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
