import chalk from 'chalk';
import ora, { oraPromise } from 'ora';
import { Command, Option } from '@commander-js/extra-typings';
import * as fs from 'fs';
import { loadWalletKey, uiToNative, writeToFile } from './lib/helpers';
import {
  createCnftLUT,
  createLUT,
  createLUTWithAddresses,
  extendLUT,
} from 'lib/manageLUT';
import {
  CreateCollectionArgs,
  CreateNftArgs,
  MetadataConfig,
  NftCollection,
  UpdateNftArgs,
} from './types/collection';
import { createCollection } from './lib/createCollection';
import { createMerkleTree } from './lib/createMerkleTree';
import {
  fetchCnftByAssetId,
  fetchCnftByTreeAndLeaf,
  fetchCnftsByCollection,
  fetchCnftsByOwner,
  mintNftIxTokenPayment,
  searchCnfts,
  updateNft,
} from 'lib/manageNft';
import { TokenPayment } from 'types/tokenPayment';
import {
  Cluster,
  Connection,
  PublicKey,
  VersionedTransaction,
  clusterApiUrl,
} from '@solana/web3.js';
import { getMint } from '@solana/spl-token';
import { confirm } from '@inquirer/prompts';

const error = chalk.bold.red;
const success = chalk.bold.greenBright;
const warning = chalk.hex('#FFA500');
const magentaB = chalk.magentaBright;
const cliProgram = new Command();

cliProgram
  .name('cnft-cli')
  .description('CLI for CNFT Minting and Management')
  .version('0.0.1');

programCommand('createLUT', { requireWallet: true })
  .description('Create a new LUT')
  .addOption(
    new Option('-a, --addresses <path>', 'Addresses to add to LUT').argParser(
      (val) => JSON.parse(fs.readFileSync(val, 'utf-8')) as string[],
    ),
  )
  .option('--cnft', 'Create a CNFT LUT')
  .action(async (opts) => {
    const keypair = loadWalletKey(opts.keypair);
    if (opts.addresses && opts.cnft) {
      const res = await createCnftLUT(keypair.secretKey, opts.rpc);
      const extendRes = await extendLUT(
        keypair.secretKey,
        opts.addresses,
        opts.rpc,
        res.lutAddress.toString(),
      );
      ora(`LUT created at: ${res.lutAddress}`).succeed();
      return;
    } else if (opts.addresses) {
      const res = await createLUTWithAddresses(
        keypair.secretKey,
        opts.addresses,
        opts.rpc,
      );
      ora(`LUT created at: ${magentaB(res.lutAddress)}`).succeed();
      return;
    } else if (!opts.addresses && opts.cnft) {
      const res = await createCnftLUT(keypair.secretKey, opts.rpc);
      ora(`LUT created at: ${magentaB(res.lutAddress.toString())}`).succeed();
      return;
    } else {
      const res = await createLUT(keypair.secretKey, opts.rpc);
      ora(`LUT created at: ${magentaB(res.lutAddress.toString())}`).succeed();
      return;
    }
  });

programCommand('extendLUT', { requireWallet: true })
  .description('Extend an existing LUT')
  .addOption(
    new Option('-a, --addresses <path>', 'Addresses to add to LUT').argParser(
      (val) => JSON.parse(fs.readFileSync(val, 'utf-8')) as string[],
    ),
  )
  .addOption(new Option('-l, --lut <string>', 'LUT address'))
  .addOption(
    new Option('-s, --slot <number>', 'Recent slot').argParser((val) =>
      parseInt(val),
    ),
  )
  .action(async (opts) => {
    const keypair = loadWalletKey(opts.keypair);
    const res = await extendLUT(
      keypair.secretKey,
      opts.addresses,
      opts.rpc,
      opts.lut || undefined,
      opts.slot || undefined,
    );
    ora(`LUT extended at: ${magentaB(opts.lut)}`).succeed();
  });

programCommand('createCollection')
  .description('Create a new cNFT Collection')
  .addOption(new Option('-n, --name <string>', 'Collection name'))
  .addOption(new Option('-s, --symbol <string>', 'Collection symbol'))
  .addOption(new Option('-d, --description <string>', 'Collection description'))
  .addOption(
    new Option('-f, --sellerFeeBasisPoints <number>', 'Seller fee basis points')
      .argParser((val) => parseInt(val))
      .default(500),
  )
  .addOption(new Option('-i, --imagePath <string>', 'Image path'))
  .addOption(new Option('-ex, --externalUrl <string>', 'External URL'))
  .addOption(new Option('-l, --lut <string>', 'LUT address'))
  .action(async (opts) => {
    const keypair = loadWalletKey(opts.keypair);
    const createCollectionArgs: CreateCollectionArgs = {
      name: opts.name,
      symbol: opts.symbol,
      description: opts.description,
      sellerFeeBasisPoints: opts.sellerFeeBasisPoints,
      externalUrl: opts.externalUrl,
    };
    const res = await createCollection(
      keypair.secretKey,
      createCollectionArgs,
      opts.imagePath,
      opts.rpc,
      opts.lut,
    );
    ora(`Collection created at: ${magentaB(res.collectionMint)}`).succeed();
    writeToFile(res, `collection-${res.collectionMint}.json`, {
      writeToFile: opts.log,
    });
  });

programCommand('createMerkleTree', { requireWallet: true })
  .description('Create a new Merkle Tree')
  .addOption(new Option('-l, --lut <path>', 'Address to add to LUT'))
  .addOption(
    new Option('-md, --maxDepth <number>', 'Max depth of the tree').argParser(
      (val) => parseInt(val),
    ),
  )
  .addOption(
    new Option('-mb, --maxBuffer <number>', 'Max buffer of the tree').argParser(
      (val) => parseInt(val),
    ),
  )
  .action(async (opts) => {
    const keypair = loadWalletKey(opts.keypair);
    const res = await createMerkleTree(
      keypair.secretKey,
      opts.rpc,
      opts.lut,
      opts.maxDepth,
      opts.maxBuffer,
    );
    ora(
      `Merkle Tree created at: ${magentaB(res.merkleTreeAddress)}. Signature: ${success(res.signature)}`,
    ).succeed();
    writeToFile(res, `merkleTree-${res.merkleTreeAddress}.json`, {
      writeToFile: opts.log,
    });
  });

programCommand('mintNftTokenPayment', { requireWallet: true })
  .description('Mint a new NFT. Keypair is the collection authority')
  .addOption(
    new Option(
      '-cf, --config <path>',
      'Path for config of collection and metadata',
    )
      .argParser(
        (val) => JSON.parse(fs.readFileSync(val, 'utf-8')) as MetadataConfig,
      )
      .makeOptionMandatory(),
  )
  .addOption(
    new Option(
      '-p, --payer <path>',
      'Payer and reciver of nft wallet path',
    ).makeOptionMandatory(),
  )
  .addOption(
    new Option('-i, --imagePath <string>', 'Image path').makeOptionMandatory(),
  )
  .addOption(new Option('-l, --lut <string>', 'LUT address'))
  .addOption(new Option('-tm, --mint <string>', 'Token Mint address'))
  .addOption(
    new Option('-amt, --amount <number>', 'Token amount to send')
      .argParser((val) => parseFloat(val))
      .makeOptionMandatory(),
  )
  .action(async (opts) => {
    const keypair = loadWalletKey(opts.keypair);
    const payer = loadWalletKey(opts.payer);
    const connection = new Connection(
      opts.rpc || clusterApiUrl(opts.env as Cluster),
    );
    let amountToSend = opts.amount;
    const mint = await oraPromise(
      getMint(connection, new PublicKey(opts.mint)),
      {
        text: `Fetching token mint ${opts.mint}...`,
        spinner: 'bouncingBall',
        successText: success(`Token mint found!`),
        failText: error(`Token mint not found!`),
      },
    );
    const accountsForDecimal = await confirm({
      message: warning(
        `Token mint has ${mint.decimals} decimals. Is the amount account for the decimals or is it the UI amount?\n i.e. 1.5 or 1500000 for 6 decimals. If no, the amount will be formatted.`,
      ),
    });
    if (!accountsForDecimal) {
      amountToSend = uiToNative(amountToSend, mint.decimals);
    }
    const tokenPayment: TokenPayment = {
      to: keypair.publicKey.toBase58(),
      from: payer.publicKey.toBase58(),
      amount: amountToSend,
      decimals: mint.decimals,
      mint: mint.address.toBase58(),
    };
    const createNftArgs: CreateNftArgs = {
      mintTo: payer.publicKey.toBase58(),
      name: opts.config.name,
      attributes: opts.config.attributes,
      creators: opts.config.creators,
      collectionMint: opts.config.address,
      imagePath: {
        isUri: false,
        path: opts.imagePath,
      },
    };
    const collection: NftCollection = {
      sellerFeeBasisPoints: opts.config.sellerFeeBasisPoints,
      address: opts.config.address,
      symbol: opts.config.symbol,
      name: opts.config.name,
      description: opts.config.description,
      externalUrl: opts.config.externalUrl,
      primarySaleHappened: opts.config.primarySaleHappened,
      verified: opts.config.verified,
    };
    const res = await mintNftIxTokenPayment(
      payer.publicKey.toBase58(),
      tokenPayment,
      createNftArgs,
      collection,
      opts.config.merkleTreeAddress,
      opts.rpc,
      opts.lut,
    );
    const buffer = Buffer.from(res, 'base64');
    const txn = VersionedTransaction.deserialize(buffer);
    txn.sign([payer]);

    const signature = await connection.sendTransaction(txn);
    ora(`NFT minted! Signature: ${magentaB(signature)}`).succeed();

    writeToFile(res, `nfts-${signature}.json`, {
      writeToFile: opts.log,
    });
  });

programCommand('updateNft', { requireWallet: true })
  .description('Update an NFT')
  .addOption(new Option('-a, --assetId <string>', 'AssetId of the CNFT'))
  .addOption(new Option('-n, --name <string>', 'Name of the CNFT'))
  .addOption(new Option('-u, --uri <string>', 'URI of the CNFT'))
  .addOption(
    new Option('-co, --collection <string>', 'Collection mint of the CNFT'),
  )
  .addOption(new Option('-l, --lut <string>', 'LUT address'))
  .action(async (opts) => {
    const keypair = loadWalletKey(opts.keypair);
    const updateArgs: UpdateNftArgs = {
      assetId: opts.assetId,
      uri: opts.uri,
      name: opts.name,
    };
    const res = await updateNft(
      keypair.secretKey,
      updateArgs,
      opts.collection,
      opts.lut,
      opts.rpc,
    );
    ora(`NFT updated!`).succeed();
    writeToFile(res, `nft-${opts.assetId}.json`, {
      writeToFile: opts.log,
    });
  });

programCommand('fetchSingle', { requireWallet: false })
  .description('Fetch a CNFT')
  .addOption(new Option('-a, --assetId <string>', 'AssetId of the CNFT'))
  .option('--no-proof', 'Exclude proof')
  .addOption(
    new Option(
      '-mt, --merkleTree <string>',
      'Merkle Tree address. Optional if assetId is provided',
    ),
  )
  .addOption(
    new Option(
      '-li, --leafIndex <number>',
      'Leaf index of the CNFT. Optional if assetId is provided',
    ).argParser((val) => parseInt(val)),
  )
  .action(async (opts) => {
    try {
      if (opts.assetId) {
        const res = await oraPromise(
          fetchCnftByAssetId(opts.assetId, opts.rpc, opts.proof),
          {
            text: `Fetching CNFT with assetId: ${opts.assetId}...`,
            spinner: 'binary',
            successText: success(`CNFT found!`),
            failText: error(`CNFT not found!`),
          },
        );
        ora(success(`${JSON.stringify(res, null, 2)}`)).succeed();
        writeToFile(res, `cnft-${opts.assetId}.json`);
      } else if (opts.merkleTree && opts.leafIndex) {
        const res = await oraPromise(
          fetchCnftByTreeAndLeaf(
            opts.merkleTree,
            opts.leafIndex,
            opts.rpc,
            opts.proof,
          ),
          {
            text: `Fetching CNFT with tree and leaf: ${opts.merkleTree} ${opts.leafIndex}...`,
            spinner: 'binary',
            successText: success(`CNFT found!`),
            failText: error(`CNFT not found!`),
          },
        );
        ora(magentaB(`${JSON.stringify(res, null, 2)}`)).succeed();
        writeToFile(res, `cnft-${opts.merkleTree}-${opts.leafIndex}.json`, {
          writeToFile: opts.log,
        });
      }
    } catch (error) {
      console.log(error);
      ora(`Error: ${error}`).fail();
    }
  });

programCommand('fetchCnfts', { requireWallet: false })
  .description('Fetch a CNFTs by collection or owner')
  .addOption(
    new Option('-co, --collection <string>', 'Collection Address of the CNFT'),
  )
  .addOption(
    new Option(
      '-ow, --owner <string>',
      'Address of owner to fetch CNFTs. Optional if collection is provided. If both are provided, results will by filtered for owner by collection.',
    ),
  )
  .option('--no-paginate', 'Do not paginate all results. Returns 1000 max.')
  .action(async (opts) => {
    try {
      if (opts.collection && !opts.owner) {
        const res = await oraPromise(
          fetchCnftsByCollection(opts.collection, opts.rpc, opts.paginate),
          {
            text: `Fetching CNFTs for collection: ${opts.collection}...`,
            spinner: 'binary',
            successText: success(`CNFTs found!`),
            failText: error(`CNFTs not found!`),
          },
        );
        writeToFile(res, `cnfts-collection${opts.collection}.json`);
      } else if (opts.collection && opts.owner) {
        const res = await oraPromise(
          fetchCnftsByOwner(
            opts.owner,
            opts.collection,
            opts.rpc,
            opts.paginate,
          ),
          {
            text: `Fetching CNFTs for owner ${opts.owner} and collection: ${opts.collection}...`,
            spinner: 'binary',
            successText: success(`CNFTs found!`),
            failText: error(`CNFTs not found!`),
          },
        );
        ora(magentaB(`${JSON.stringify(res, null, 2)}`)).succeed();
        writeToFile(
          res,
          `cnft-collection-${opts.collection}-${opts.owner}.json`,
          { writeToFile: opts.log },
        );
      } else if (opts.owner && !opts.collection) {
        const res = await oraPromise(
          fetchCnftsByOwner(opts.owner, undefined, opts.rpc, opts.paginate),
          {
            text: `Fetching CNFTs for owner: ${opts.owner}...`,
            spinner: 'binary',
            successText: success(`CNFTs found!`),
            failText: error(`CNFTs not found!`),
          },
        );
        writeToFile(res, `cnfts-owner-${opts.owner}.json`, {
          writeToFile: opts.log,
        });
      } else {
        ora(`No collection or owner provided`).fail();
      }
    } catch (error) {
      ora(`Error: ${error}`).fail();
    }
  });

programCommand('search', { requireWallet: false })
  .description('Search CNFTs by collection or owner')
  .addOption(
    new Option('-co, --collection <string>', 'Collection Address of the CNFT'),
  )
  .addOption(
    new Option(
      '-ow, --owner <string>',
      'Address of owner to fetch CNFTs. Optional if collection is provided. If both are provided, results will by filtered for owner by collection.',
    ),
  )
  .option('--no-paginate', 'Do not paginate all results. Returns 1000 max.')
  .option('--no-compressed', 'Search non-compressed assets')
  .action(async (opts) => {
    try {
      const res = await oraPromise(
        searchCnfts(
          opts.owner,
          opts.collection,
          opts.compressed,
          opts.rpc,
          opts.paginate,
        ),
        {
          text: `Fetching CNFTs...`,
          spinner: 'binary',
          successText: success(`CNFTs found!`),
          failText: error(`CNFTs not found!`),
        },
      );
      const fileName = `cnfts-search-${opts.collection && opts.owner ? `c-${opts.collection}-o${opts.owner}` : opts.collection ?? opts.owner}.json`;
      writeToFile(res, fileName, { writeToFile: opts.log });
    } catch (error) {
      ora(`Error: ${error}`).fail();
    }
  });

function programCommand(
  name: string,
  options: { requireWallet: boolean } = { requireWallet: true },
) {
  const cmProgram = cliProgram
    .command(name)
    .option(
      '-e, --env <string>',
      'Solana cluster env name',
      'devnet', //mainnet-beta, testnet, devnet
    )
    .addOption(
      new Option(
        '-k, --keypair <path>',
        `Solana wallet location`,
      ).makeOptionMandatory(options.requireWallet),
    )
    .addOption(new Option('-r, --rpc <string>', `RPC URL`))
    .option('--no-log', 'Do not log the result to a file');
  return cmProgram;
}

cliProgram.parse(process.argv);
