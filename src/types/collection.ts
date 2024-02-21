export type CreateCollectionArgs = {
  name: string;
  symbol: string;
  description: string;
  sellerFeeBasisPoints: number;
  image?: string;
  externalUrl?: string;
};

export type NftCollection = {
  address: string;
  name: string;
  symbol: string;
  description?: string;
  sellerFeeBasisPoints: number;
  primarySaleHappened?: boolean;
  verified?: boolean;
  externalUrl?: string;
};

export type MetadataConfig = {
  address: string;
  merkleTreeAddress: string;
  name: string;
  symbol: string;
  description?: string;
  sellerFeeBasisPoints: number;
  primarySaleHappened?: boolean;
  verified?: boolean;
  externalUrl?: string;
  creators?: Creator[];
  attributes?: Attribute[];
};

export type Creator = {
  address: string;
  verified: boolean;
  share: number;
};

export type CreateNftArgs = {
  creators?: Creator[];
  mintTo?: string;
  name: string;
  collectionMint: string;
  attributes: Attribute[];
  imagePath?: {
    isUri: boolean;
    path: string;
    data?: Buffer;
  };
};

export type UpdateNftArgs = {
  assetId: string;
  name?: string;
  attributes?: Attribute[];
  uri?: string;
};

export type Attribute = {
  trait_type: string;
  value: string | number;
};
