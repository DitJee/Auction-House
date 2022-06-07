import { PublicKey, clusterApiUrl, Keypair } from "@solana/web3.js";

export const AUCTION_HOUSE = "auction_house";
export const FEE_PAYER = "fee_payer";
export const TREASURY = "treasury";

export const AUCTION_HOUSE_PROGRAM_ID = new PublicKey(
  "Er4qqGJpN9CkQWeUp1P87aWYzkCqd4NbbKi8vtoNfPUJ"
  // "hausS13jsjafwWwGqZTUQRmWyvyxn9EQpqMwV1PBBmk"
);

export const AUCTION_HOUSE_PROGRAM_ID_STRING =
  "Er4qqGJpN9CkQWeUp1P87aWYzkCqd4NbbKi8vtoNfPUJ";

export const WRAPPED_SOL_MINT = new PublicKey(
  "So11111111111111111111111111111111111111112"
);

export const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);

export const SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
);

export type Cluster = {
  name: string;
  url: string;
};

export const CLUSTERS: Cluster[] = [
  {
    name: "mainnet-beta",
    url: clusterApiUrl(),
  },
];

export const loadWalletKey = (keypair): Keypair => {
  if (!keypair || keypair == "") {
    throw new Error("Keypair is required!");
  }
  const loaded = Keypair.fromSecretKey(new Uint8Array(keypair));
  console.log(`wallet public key: ${loaded.publicKey}`);
  return loaded;
};

export const DEFAULT_CLUSTER = {};
