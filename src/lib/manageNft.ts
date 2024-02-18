import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import {
  createGenericFile,
  createNoopSigner,
  createSignerFromKeypair,
  keypairIdentity,
  none,
  publicKey,
  signerIdentity,
  some,
} from '@metaplex-foundation/umi';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { nftStorageUploader } from '@metaplex-foundation/umi-uploader-nft-storage';
import {
  TransactionMessage,
  clusterApiUrl,
  VersionedTransaction,
  Connection,
} from '@solana/web3.js';
import * as bs58 from 'bs58';
import {
  CreateNftArgs,
  NftCollection,
  UpdateNftArgs,
} from '../types/collection';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import {
  UpdateArgsArgs,
  fetchMerkleTree,
  getAssetWithProof,
  mintToCollectionV1,
  updateMetadata,
} from '@metaplex-foundation/mpl-bubblegum';
import {
  fetchAddressLookupTable,
  fetchAllTokenByOwnerAndMint,
  fetchToken,
  fetchTokensByOwner,
  transferTokensChecked,
} from '@metaplex-foundation/mpl-toolbox';
import { loadWalletKey, toBuffer } from './helpers';
import {
  fromWeb3JsKeypair,
  toWeb3JsInstruction,
  toWeb3JsKeypair,
  toWeb3JsPublicKey,
} from '@metaplex-foundation/umi-web3js-adapters';
import { TokenPayment } from '../types/tokenPayment';
dotenv.config();

export async function mintNft(
  keyPair: string | Uint8Array,
  args: CreateNftArgs,
  collection: NftCollection,
  merkleTree: string,
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
  const merkleTreeAccount = await fetchMerkleTree(umi, publicKey(merkleTree));
  const imagePath = args.imagePath;
  let image = '';
  if (imagePath) {
    if (imagePath.isUri) {
      image = imagePath.path;
    } else if (imagePath.path && !imagePath.data) {
      const imageBuffer = fs.readFileSync(imagePath.path);
      const genericFile = createGenericFile(imageBuffer, imagePath.path);
      const [imageUri] = await umi.uploader.upload([genericFile]);
      image = imageUri;
    } else if (imagePath.data) {
      const genericFile = createGenericFile(
        new Uint8Array(imagePath.data),
        'image.png',
      );
      const [imageUri] = await umi.uploader.upload([genericFile]);
      image = imageUri;
    } else {
      throw new Error('Invalid image path');
    }
  }

  const nftItemJsonObject = {
    name: collection.name,
    symbol: collection.symbol,
    description: collection.description,
    seller_fee_basis_points: collection.sellerFeeBasisPoints,
    image: image,
    external_url: collection.externalUrl,
    attributes: args.attributes,
    properties: {
      category: 'image',
      files: [
        {
          file: image,
          type: 'image/png',
        },
      ],
      creators: args.creators ?? [],
    },
  };

  const nftItemJsonUri = await umi.uploader.uploadJson(nftItemJsonObject);
  console.log('nftItemJsonUri:', nftItemJsonUri);

  let ix = mintToCollectionV1(umi, {
    leafOwner: args.mintTo ? publicKey(args.mintTo) : umiKeypair.publicKey,
    merkleTree: merkleTreeAccount.publicKey,
    collectionMint: publicKey(collection.address),
    metadata: {
      name: args.name,
      uri: nftItemJsonUri,
      sellerFeeBasisPoints: collection.sellerFeeBasisPoints,
      collection: { key: publicKey(collection.address), verified: false },
      creators:
        args.creators?.map((creator) => {
          return {
            address: publicKey(creator.address),
            verified: creator.verified,
            share: creator.share,
          };
        }) ?? [],
    },
  });

  if (lutAddress) {
    const lut = await fetchAddressLookupTable(umi, publicKey(lutAddress));
    ix = ix.setAddressLookupTables([
      { publicKey: lut.publicKey, addresses: lut.addresses },
    ]);
    console.log('added lut to txn');
  }

  const res = await ix.sendAndConfirm(umi);

  return res;
}

export async function mintNftIx(
  keyPair: string | Uint8Array,
  args: CreateNftArgs,
  collection: NftCollection,
  merkleTree: string,
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
  const merkleTreeAccount = await fetchMerkleTree(umi, publicKey(merkleTree));
  const imagePath = args.imagePath;
  let image = '';
  if (imagePath) {
    if (imagePath.isUri) {
      image = imagePath.path;
    } else if (imagePath.path && !imagePath.data) {
      const imageBuffer = fs.readFileSync(imagePath.path);
      const genericFile = createGenericFile(imageBuffer, imagePath.path);
      const [imageUri] = await umi.uploader.upload([genericFile]);
      image = imageUri;
    } else if (imagePath.data) {
      const genericFile = createGenericFile(
        new Uint8Array(imagePath.data),
        'image.png',
      );
      const [imageUri] = await umi.uploader.upload([genericFile]);
      image = imageUri;
    } else {
      throw new Error('Invalid image path');
    }
  }

  const nftItemJsonObject = {
    name: collection.name,
    symbol: collection.symbol,
    description: collection.description,
    seller_fee_basis_points: collection.sellerFeeBasisPoints,
    image: image,
    external_url: collection.externalUrl,
    attributes: args.attributes,
    properties: {
      category: 'image',
      files: [
        {
          file: image,
          type: 'image/png',
        },
      ],
      creators: args.creators ?? [],
    },
  };

  const nftItemJsonUri = await umi.uploader.uploadJson(nftItemJsonObject);
  console.log('nftItemJsonUri:', nftItemJsonUri);

  const ix = mintToCollectionV1(umi, {
    leafOwner: args.mintTo ? publicKey(args.mintTo) : umiKeypair.publicKey,
    merkleTree: merkleTreeAccount.publicKey,
    collectionMint: publicKey(collection.address),
    metadata: {
      name: args.name,
      uri: nftItemJsonUri,
      sellerFeeBasisPoints: collection.sellerFeeBasisPoints,
      collection: { key: publicKey(collection.address), verified: false },
      creators:
        args.creators?.map((creator) => {
          return {
            address: publicKey(creator.address),
            verified: creator.verified,
            share: creator.share,
          };
        }) ?? [],
    },
  });

  if (lutAddress) {
    const lut = await fetchAddressLookupTable(umi, publicKey(lutAddress));
    ix.setAddressLookupTables([
      { publicKey: lut.publicKey, addresses: lut.addresses },
    ]);
    console.log('added lut to txn');
  }
  return ix;
}

export async function mintNftIxTokenPayment(
  payer: string,
  payment: TokenPayment,
  args: CreateNftArgs,
  collection: NftCollection,
  merkleTree: string,
  rpcUrl?: string,
  lutAddress?: string,
) {
  if (!process.env.NFT_STORAGE_API_KEY) {
    throw new Error('NFT_STORAGE_API_KEY is not set');
  }
  if (!process.env.COLLECTION_AUTH) {
    throw new Error('COLLECTION_AUTH is not set');
  }
  const collectionAuth = process.env.COLLECTION_AUTH;
  const collectionAuthKeypair = fromWeb3JsKeypair(
    loadWalletKey(JSON.parse(collectionAuth) as number[]),
  );

  const umi = createUmi(rpcUrl || clusterApiUrl('devnet'))
    .use(mplTokenMetadata())
    .use(nftStorageUploader({ token: process.env.NFT_STORAGE_API_KEY }));
  //check if keypair is string, if so convert to Uint8Array
  const collectionSigner = createSignerFromKeypair(umi, collectionAuthKeypair);
  const merkleTreeAccount = await fetchMerkleTree(umi, publicKey(merkleTree));
  umi.use(signerIdentity(collectionSigner));

  const toTokenFetch = await fetchAllTokenByOwnerAndMint(
    umi,
    publicKey(payment.to),
    publicKey(payment.mint),
    {
      tokenStrategy: 'getTokenAccountsByOwner',
    },
  );

  const fromTokenFetch = await fetchAllTokenByOwnerAndMint(
    umi,
    publicKey(payment.from),
    publicKey(payment.mint),
    {
      tokenStrategy: 'getTokenAccountsByOwner',
    },
  );
  const transferIx = transferTokensChecked(umi, {
    source: fromTokenFetch[0].publicKey,
    destination: toTokenFetch[0].publicKey,
    amount: payment.amount,
    mint: publicKey(payment.mint),
    authority: createNoopSigner(publicKey(payment.from)),
    decimals: payment.decimals,
  }).useV0();
  const imagePath = args.imagePath;
  let image = '';
  if (imagePath) {
    if (imagePath.isUri) {
      image = imagePath.path;
    } else if (imagePath.path && !imagePath.data) {
      const imageBuffer = fs.readFileSync(imagePath.path);
      const genericFile = createGenericFile(imageBuffer, imagePath.path);
      const [imageUri] = await umi.uploader.upload([genericFile]);
      image = imageUri;
    } else if (imagePath.data) {
      const genericFile = createGenericFile(
        new Uint8Array(imagePath.data),
        'image.png',
      );
      const [imageUri] = await umi.uploader.upload([genericFile]);
      image = imageUri;
    } else {
      throw new Error('Invalid image path');
    }
  }

  const nftItemJsonObject = {
    name: collection.name,
    symbol: collection.symbol,
    description: collection.description,
    seller_fee_basis_points: collection.sellerFeeBasisPoints,
    image: image,
    external_url: collection.externalUrl,
    attributes: args.attributes,
    properties: {
      category: 'image',
      files: [
        {
          file: image,
          type: 'image/png',
        },
      ],
      creators: args.creators ?? [],
    },
  };

  const nftItemJsonUri = await umi.uploader.uploadJson(nftItemJsonObject);
  console.log('nftItemJsonUri:', nftItemJsonUri);

  let ix = mintToCollectionV1(umi, {
    leafOwner: args.mintTo
      ? publicKey(args.mintTo)
      : collectionAuthKeypair.publicKey,
    payer: createNoopSigner(publicKey(payer)),
    merkleTree: merkleTreeAccount.publicKey,
    collectionMint: publicKey(collection.address),
    collectionAuthority: collectionSigner,
    metadata: {
      name: args.name,
      uri: nftItemJsonUri,
      sellerFeeBasisPoints: collection.sellerFeeBasisPoints,
      collection: { key: publicKey(collection.address), verified: false },
      creators:
        args.creators?.map((creator) => {
          return {
            address: publicKey(creator.address),
            verified: creator.verified,
            share: creator.share,
          };
        }) ?? [],
    },
  }).useV0();
  ix = ix.append(transferIx);

  if (lutAddress) {
    const lut = await fetchAddressLookupTable(umi, publicKey(lutAddress));
    ix = ix.setAddressLookupTables([
      { publicKey: lut.publicKey, addresses: lut.addresses },
    ]);
    console.log('added lut to txn');
  }

  console.log('fits?', ix.fitsInOneTransaction(umi));
  const mappedIx = ix.getInstructions().map(toWeb3JsInstruction);
  const latestBlock = await umi.rpc.getLatestBlockhash();
  const connection = new Connection(rpcUrl || clusterApiUrl('devnet'));
  const lookupTableAccount = (
    await connection.getAddressLookupTable(
      toWeb3JsPublicKey(publicKey(lutAddress)),
    )
  ).value;
  const versioned = new TransactionMessage({
    payerKey: toWeb3JsPublicKey(publicKey(payer)),
    recentBlockhash: latestBlock.blockhash,
    instructions: mappedIx,
  }).compileToV0Message([lookupTableAccount]);
  const transaction = new VersionedTransaction(versioned);
  transaction.sign([toWeb3JsKeypair(collectionAuthKeypair)]);
  const builtTx = transaction.serialize();
  return toBuffer(builtTx).toString('base64');
}

export async function updateNft(
  keyPair: string | Uint8Array,
  args: UpdateNftArgs,
  collectionMint: string,
  lutAddress?: string,
  rpcUrl?: string,
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
  const rpcAssetProof = await getAssetWithProof(umi, publicKey(args.assetId));
  const updateArgs: UpdateArgsArgs = {
    name: args.name ? some(args.name) : none(),
    uri: args.uri ? some(args.uri) : none(),
  };
  let ix = updateMetadata(umi, {
    ...rpcAssetProof,
    leafOwner: rpcAssetProof.leafOwner,
    currentMetadata: rpcAssetProof.metadata,
    updateArgs,
    authority: signer,
    collectionMint: publicKey(collectionMint),
  });
  if (lutAddress) {
    const lut = await fetchAddressLookupTable(umi, publicKey(lutAddress));
    ix = ix.setAddressLookupTables([
      { publicKey: lut.publicKey, addresses: lut.addresses },
    ]);
    console.log('added lut to txn');
  }
  const res = await ix.sendAndConfirm(umi);
  return res;
}
