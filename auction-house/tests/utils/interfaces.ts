import { PublicKeyInitData, Keypair } from "@solana/web3.js";

export type CreateAuctionHouseArgs = {
  keypair: Keypair;
  env: string;
  sellerFeeBasisPoints: number;
  canChangeSalePrice: boolean;
  requiresSignOff: boolean;
  treasuryWithdrawalDestination: PublicKeyInitData;
  feeWithdrawalDestination: PublicKeyInitData;
  treasuryMint: PublicKeyInitData;
};
