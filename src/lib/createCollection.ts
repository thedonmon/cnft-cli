import {
  createNft,
  mplTokenMetadata,
} from '@metaplex-foundation/mpl-token-metadata';
import {
  createGenericFile,
  createSignerFromKeypair,
  generateSigner,
  percentAmount,
  signerIdentity,
} from '@metaplex-foundation/umi';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { nftStorageUploader } from '@metaplex-foundation/umi-uploader-nft-storage';
import { clusterApiUrl } from '@solana/web3.js';
import * as bs58 from 'bs58';
import { CreateCollectionArgs } from '../types/collection';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { extendLUT } from './manageLUT';
dotenv.config();

/**
 * Create a new collection
 * @param keyPair - Keypair to use for creating the collection
 * @param args - Arguments for creating the collection
 * @param imageFilePath - Path to the image file for the collection
 * @param rpcUrl - RPC URL to use for creating the collection
 * @param lutAddress - Address of the LUT to extend with the collection
 * @returns Signature string and collection mint address
 */
export async function createCollection(
  keyPair: string | Uint8Array,
  args: CreateCollectionArgs,
  imageFilePath: string,
  rpcUrl?: string,
  lutAddress?: string,
) {
  if (!process.env.NFT_STORAGE_API_KEY) {
    throw new Error('NFT_STORAGE_API_KEY is not set');
  }
  const umi = createUmi(rpcUrl || clusterApiUrl('devnet'))
    .use(mplTokenMetadata())
    .use(nftStorageUploader({ token: process.env.NFT_STORAGE_API_KEY }));
  //check if keypair is string, if so convert to Uint8Array
  const keypair = typeof keyPair === 'string' ? bs58.decode(keyPair) : keyPair;
  const umiKeypair = umi.eddsa.createKeypairFromSecretKey(keypair);
  const signer = createSignerFromKeypair({ eddsa: umi.eddsa }, umiKeypair);
  umi.use(signerIdentity(signer));
  const collectionImageBuffer = fs.readFileSync(imageFilePath);
  const collectionImageGenericFile = createGenericFile(
    collectionImageBuffer,
    imageFilePath,
  );
  const [collectionImageUri] = await umi.uploader.upload([
    collectionImageGenericFile,
  ]);
  console.log('collectionImageUri:', collectionImageUri);

  const collectionObject = {
    name: args.name,
    symbol: args.symbol,
    description: args.description,
    seller_fee_basis_points: args.sellerFeeBasisPoints * 100,
    image: collectionImageUri,
    external_url: args.externalUrl,
    properties: {
      category: 'image',
      files: [
        {
          file: collectionImageUri,
          type: 'image/png',
        },
      ],
    },
  };
  const collectionJsonUri = await umi.uploader.uploadJson(collectionObject);
  const collectionMint = generateSigner(umi);
  const res = await createNft(umi, {
    mint: collectionMint,
    symbol: args.symbol,
    name: args.name,
    uri: collectionJsonUri,
    sellerFeeBasisPoints: percentAmount(args.sellerFeeBasisPoints),
    isCollection: true,
  }).sendAndConfirm(umi);
  console.log('Collection created:', collectionMint.publicKey.toString());

  if (lutAddress) {
    await extendLUT(
      umiKeypair.secretKey,
      [collectionMint.publicKey.toString()],
      rpcUrl,
      lutAddress,
    );
    console.log('LUT extended');
  }

  return {
    signature: bs58.encode(res.signature),
    collectionMint: collectionMint.publicKey.toString(),
  };
}
