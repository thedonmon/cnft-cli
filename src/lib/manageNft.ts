import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import {
  createGenericFile,
  createNoopSigner,
  createSignerFromKeypair,
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
  MPL_BUBBLEGUM_PROGRAM_ID,
  UpdateArgsArgs,
  fetchMerkleTree,
  findLeafAssetIdPda,
  getAssetWithProof,
  mintToCollectionV1,
  updateMetadata,
} from '@metaplex-foundation/mpl-bubblegum';
import {
  fetchAddressLookupTable,
  fetchAllTokenByOwnerAndMint,
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
import { fetchWithAutoPagination } from '../types/das';
import {
  SearchAssetsRpcInput,
  dasApi,
} from '@metaplex-foundation/digital-asset-standard-api';
import { createCnftLUT, extendLUT } from './manageLUT';

dotenv.config();

/**
 * Mint NFT
 * @param keyPair - keypair to sign the transaction
 * @param args  - the createNftArgs for data about the nft to be created
 * @param collection - the collection information
 * @param merkleTree - the merkle tree address
 * @param rpcUrl - the rpc url. default is devnet
 * @param lutAddress - address of the lookup table to use if provided
 * @returns TransactionSignature
 */
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

  const nftJson = {
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

  const nftJsonUri = await umi.uploader.uploadJson(nftJson);
  console.log('nftItemJsonUri:', nftJsonUri);

  let ix = mintToCollectionV1(umi, {
    leafOwner: args.mintTo ? publicKey(args.mintTo) : umiKeypair.publicKey,
    merkleTree: merkleTreeAccount.publicKey,
    collectionMint: publicKey(collection.address),
    metadata: {
      name: args.name,
      uri: nftJsonUri,
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

/**
 * Mint NFT Transaction builder.
 * @param keyPair - keypair to sign the transaction
 * @param args  - the createNftArgs for data about the nft to be created
 * @param collection - the collection information
 * @param merkleTree - the merkle tree address
 * @param rpcUrl - the rpc url. default is devnet
 * @param lutAddress - address of the lookup table to use if provided
 * @returns TranactionBuilder
 */
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

  const nftJson = {
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

  const nftJsonUri = await umi.uploader.uploadJson(nftJson);
  console.log('nftJsonUri:', nftJsonUri);

  let ix = mintToCollectionV1(umi, {
    leafOwner: args.mintTo ? publicKey(args.mintTo) : umiKeypair.publicKey,
    merkleTree: merkleTreeAccount.publicKey,
    collectionMint: publicKey(collection.address),
    metadata: {
      name: args.name,
      uri: nftJsonUri,
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
  return ix;
}

/**
 * This explicilty is meant for generating the transaction on the backend and returning the base64 encoded transaction to be signed and sent by the frontend
 * @param payer - the public key of the payer
 * @param payment - the payment object
 * @param args - the createNftArgs for data about the nft to be created
 * @param collection - the collection information
 * @param merkleTree - the merkle tree address
 * @param rpcUrl - the rpc url. default is devnet
 * @param lutAddress - address of the lookup table to use if provided
 * @returns base64 encoded transaction
 */
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
  if (toTokenFetch.length < 1) {
    throw new Error('No token account found for the receiver');
  }
  const fromTokenFetch = await fetchAllTokenByOwnerAndMint(
    umi,
    publicKey(payment.from),
    publicKey(payment.mint),
    {
      tokenStrategy: 'getTokenAccountsByOwner',
    },
  );
  if (fromTokenFetch.length < 1) {
    throw new Error('No token account found for the payer');
  }
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

  const nftJsonObject = {
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

  const nftJsonUri = await umi.uploader.uploadJson(nftJsonObject);
  console.log('nftJsonUri:', nftJsonUri);

  let ix = mintToCollectionV1(umi, {
    leafOwner: args.mintTo
      ? publicKey(args.mintTo)
      : collectionAuthKeypair.publicKey,
    payer: createNoopSigner(publicKey(payer)),
    merkleTree: merkleTreeAccount.publicKey,
    collectionMint: publicKey(collection.address),
    collectionAuthority: collectionSigner,
    collectionAuthorityRecordPda: MPL_BUBBLEGUM_PROGRAM_ID,
    metadata: {
      name: args.name,
      uri: nftJsonUri,
      sellerFeeBasisPoints: collection.sellerFeeBasisPoints,
      primarySaleHappened: collection.primarySaleHappened,
      collection: {
        key: publicKey(collection.address),
        verified: collection.verified ?? false,
      },
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
  //ix.build().serializedMessage does not deserialize properly to a versioned txn as it expects all signatures
  //Build a versioned transaction from the umi instructions and sign it with auth while requiring the feepayers signature
  //Serialize and expect frontend to sign it.
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
  const umi = createUmi(rpcUrl || clusterApiUrl('devnet'))
    .use(mplTokenMetadata())
    .use(dasApi());
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
  console.log(ix.fitsInOneTransaction(umi));
  const res = await ix.sendAndConfirm(umi, {
    send: {
      skipPreflight: true,
    },
  });
  return {
    ...res,
    signaure: bs58.encode(res.signature),
  };
}

export async function fetchCnftsByCollection(
  collection: string,
  rpcUrl?: string,
  paginate: boolean = true,
) {
  const umi = createUmi(rpcUrl || clusterApiUrl('devnet')).use(dasApi());
  const assets = await fetchWithAutoPagination(
    umi.rpc.getAssetsByGroup,
    {
      groupKey: 'collection',
      groupValue: collection,
    },
    paginate,
  );
  return assets;
}

export async function fetchCnftsByOwner(
  owner: string,
  collectionAddress?: string,
  rpcUrl?: string,
  paginate: boolean = true,
) {
  const umi = createUmi(rpcUrl || clusterApiUrl('devnet')).use(dasApi());
  const ownerKey = publicKey(owner);
  let { items } = await fetchWithAutoPagination(
    umi.rpc.getAssetsByOwner,
    {
      owner: ownerKey,
    },
    paginate,
  );

  if (collectionAddress) {
    const filtered = items.filter((asset) =>
      asset.grouping.find(
        (group) =>
          group.group_key === 'collection' &&
          group.group_value === collectionAddress,
      ),
    );
    items = filtered;
  }
  return items;
}

export async function searchCnfts(
  owner?: string,
  collectionAddress?: string,
  compressed = true,
  rpcUrl?: string,
  paginate: boolean = true,
) {
  const umi = createUmi(rpcUrl || clusterApiUrl('devnet')).use(dasApi());
  if (!owner && !collectionAddress) {
    throw new Error('Owner or CollectionAddress must be provided');
  }
  let searchAssetRequest: SearchAssetsRpcInput = {
    compressed,
  };
  if (owner && collectionAddress) {
    searchAssetRequest = {
      ...searchAssetRequest,
      owner: publicKey(owner),
      grouping: ['collection', collectionAddress],
    };
  } else if (owner && !collectionAddress) {
    searchAssetRequest = {
      ...searchAssetRequest,
      owner: publicKey(owner),
    };
  } else {
    searchAssetRequest = {
      ...searchAssetRequest,
      grouping: ['collection', collectionAddress],
    };
  }
  const { items } = await fetchWithAutoPagination(
    umi.rpc.searchAssets,
    searchAssetRequest,
    paginate,
  );
  return items;
}

export async function fetchCnftByAssetId(
  assetId: string,
  rpcUrl?: string,
  withProof: boolean = false,
) {
  const umi = createUmi(rpcUrl || clusterApiUrl('devnet')).use(dasApi());
  const asset = withProof
    ? await getAssetWithProof(umi, publicKey(assetId))
    : await umi.rpc.getAsset(publicKey(assetId));
  return asset;
}

export async function fetchCnftByTreeAndLeaf(
  tree: string,
  leaf: number | bigint,
  rpcUrl?: string,
  withProof: boolean = false,
) {
  const umi = createUmi(rpcUrl || clusterApiUrl('devnet')).use(dasApi());
  const [assetId, _] = findLeafAssetIdPda(umi, {
    merkleTree: publicKey(tree),
    leafIndex: leaf,
  });
  const asset = withProof
    ? await getAssetWithProof(umi, publicKey(assetId))
    : await umi.rpc.getAsset(publicKey(assetId));
  return asset;
}
