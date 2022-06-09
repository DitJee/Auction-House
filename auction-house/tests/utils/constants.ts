import { AnchorProvider, web3 } from "@project-serum/anchor";
import { PublicKey, clusterApiUrl, Keypair } from "@solana/web3.js";

export const AUCTION_HOUSE = "auction_house";
export const FEE_PAYER = "fee_payer";
export const TREASURY = "treasury";
export const SIGNER = "signer";
export const METADATA = "metadata";

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

export const MINT_ADDRESS_AMONGUS = new PublicKey(
  "Bf5YrNoLeFys5UNKZuaBB5EoyMHkYgouhL29K3CW4ihb"
);

export const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
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

export const loadWalletKey = (keypair: Uint8Array): Keypair => {
  if (!keypair || keypair.toString() == "") {
    throw new Error("Keypair is required!");
  }
  const loaded = Keypair.fromSecretKey(keypair);
  // console.log(`wallet public key: ${loaded.publicKey}`);
  return loaded;
};

export const DEFAULT_CLUSTER = {};
