import { makePostRequestWithBackoff } from 'lib/helpers';
import { backOff } from 'exponential-backoff';

export type Nullable<T> = T | null;

export type Compressed = {
  type: string;
  treeId: string;
  leafIndex: number;
  seq: number;
  assetId: string;
  instructionIndex: number;
  innerInstructionIndex: number | null;
  newLeafOwner: string;
  oldLeafOwner: string | null;
  newLeafDelegate: string;
  oldLeafDelegate: string | null;
  treeDelegate: string;
  metadata: CompressedMetadata;
  updateArgs: null;
};

type CompressedMetadata = {
  name: string;
  symbol: string;
  uri: string;
  sellerFeeBasisPoints: number;
  primarySaleHappened: boolean;
  isMutable: boolean;
  tokenStandard: string;
  collection: CompressedCollection;
  tokenProgramVersion: string;
  creators: Creator[];
};

type CompressedCollection = {
  key: string;
  verified: boolean;
};

type Creator = {
  address: string;
  verified: boolean;
  share: number;
};

type NFTEvent = {
  description: string;
  type: string;
  source: string;
  amount: number;
  fee: number;
  feePayer: string;
  signature: string;
  slot: number;
  timestamp: number;
  saleType: string;
  buyer: string;
  seller: string;
  staker: string;
  nfts: NFTDetail[];
};

type NFTDetail = {
  mint: string;
  tokenStandard: string;
};

type SetAuthorityEvent = {
  account: string;
  from: string;
  to: string;
  instructionIndex: number;
  innerInstructionIndex: number;
};

export type TokenTransfer = {
  fromTokenAccount: string;
  toTokenAccount: string;
  fromUserAccount: string;
  toUserAccount: string;
  tokenAmount: number;
  mint: string;
  tokenStandard: string;
};

export type NativeTransfer = {
  fromUserAccount: string;
  toUserAccount: string;
  amount: number;
};

export type AccountData = {
  account: string;
  nativeBalanceChange: number;
  tokenBalanceChanges: TokenBalanceChange[];
};

export type TokenBalanceChange = {
  userAccount: string;
  tokenAccount: string;
  rawTokenAmount: RawTokenAmount;
  mint: string;
};

export type RawTokenAmount = {
  tokenAmount: string;
  decimals: number;
};

export type Instruction = {
  accounts: string[];
  data: string;
  programId: string;
  innerInstructions: InnerInstruction[];
};

export type InnerInstruction = {
  accounts: string[];
  data: string;
  programId: string;
};

export type Transaction = {
  description: string;
  type: string;
  source: string;
  fee: number;
  feePayer: string;
  signature: string;
  slot: number;
  timestamp: number;
  tokenTransfers: TokenTransfer[];
  nativeTransfers: NativeTransfer[];
  accountData: AccountData[];
  transactionError: null | string;
  instructions: Instruction[];
  events: {
    nft?: NFTEvent;
    setAuthority?: SetAuthorityEvent[];
    compressed?: Compressed[];
  };
};

export type TransactionsArray = Transaction[];

/**
 * Pagination params copied from non exported types in umi das plugin.
 * SortBy has a specific type as well for sortby options but wont copy over for breaking changes in case.
 * Only used to help type the autopaginate function better.
 */
export type Pagination = {
  sortBy?: Nullable<any>;
  limit?: Nullable<number>;
  page?: Nullable<number>;
  before?: Nullable<string>;
  after?: Nullable<string>;
};

export async function fetchWithAutoPagination<T, R>(
  fetchFunction: (params: T & Pagination) => Promise<{ items: R[] }>,
  params: T,
  paginate: boolean,
  pageLimit: number = 1000,
  backoffOptions?: {
    maxDelay?: number;
    numOfAttempts?: number;
    timeMultiple?: number;
    startingDelay?: number;
  },
): Promise<{ items: R[] }> {
  let allItems: R[] = [];
  let page = 1;
  let hasMore = true;
  let response: { items: R[] } = { items: [] };

  while (paginate && hasMore) {
    const modifiedParams = { ...params, page: page, limit: pageLimit } as T;
    response = backoffOptions
      ? await backOff(
          async () => await fetchFunction(modifiedParams),
          backoffOptions,
        )
      : await backOff(async () => await fetchFunction(modifiedParams), {
          jitter: 'full',
          maxDelay: 10000, // Wait up to 10 seconds between retries
          numOfAttempts: 5, // Retry up to 5 times
          timeMultiple: 2,
        });
    allItems = [...allItems, ...response.items];
    hasMore = response.items.length === pageLimit;
    page++;
  }

  return { items: allItems };
}

export type HeliusPaginateResult<T> = {
  [key: string]: unknown;
  total: number;
  limit: number;
  items: T[];
};

export type HeliusResponse = {
  jsonrpc: string;
  id: string;
  result: unknown;
};

export type HeliusPaginateResponse<T> = {
  result: HeliusPaginateResult<T>;
} & HeliusResponse;

export type GetSignauturesForAssetParams = {
  id: string;
} & Pagination;

export type GetSignatureForAssetResponse = HeliusPaginateResponse<
  [string, string]
>;

export async function getSignaturesForAsset(
  assetId: string,
  rpcUrl: string,
  paginate: boolean = true,
) {
  if (!rpcUrl) {
    throw new Error('Helius RPC URL is required!');
  }
  if (!assetId) {
    throw new Error('Asset ID is required!');
  }

  const fetchFunction = async (params: GetSignauturesForAssetParams) => {
    const response = await makePostRequestWithBackoff(rpcUrl, {
      jsonrpc: '2.0',
      id: '1',
      method: 'getSignaturesForAsset',
      params: params,
    });

    return response.result as HeliusPaginateResult<[string, string]>;
  };
  const result = await fetchWithAutoPagination(
    fetchFunction,
    { id: assetId },
    paginate,
  );
  return result;
}

export async function getEnrichedTransactions(
  heliusApiKey: string,
  env: string,
  txIds: string[],
) {
  if (!heliusApiKey) {
    throw new Error('Helius API Key is required!');
  }
  if (!txIds || txIds.length === 0) {
    throw new Error('Transaction IDs are required!');
  }

  const url = `https://api${env == 'devnet' ? '-dev' : ''}.helius.xyz/v0/transactions?api-key=${heliusApiKey}`;

  const response = await makePostRequestWithBackoff(url, {
    transactions: txIds,
  });

  return response as TransactionsArray;
}
