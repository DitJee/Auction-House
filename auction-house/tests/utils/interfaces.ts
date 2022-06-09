import { PublicKeyInitData, Keypair } from "@solana/web3.js";
import * as anchor from "@project-serum/anchor";

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

export type AuctionHouseObject = {
  auctionHouseFeeAccount: anchor.web3.PublicKey;
  auctionHouseTreasury: anchor.web3.PublicKey;
  treasuryWithdrawalDestination: anchor.web3.PublicKey;
  feeWithdrawalDestination: anchor.web3.PublicKey;
  treasuryMint: anchor.web3.PublicKey;
  authority: anchor.web3.PublicKey;
  creator: anchor.web3.PublicKey;
  bump: number;
  treasuryBump: number;
  feePayerBump: number;
  sellerFeeBasisPoints: number;
  requiresSignOff: boolean;
  canChangeSalePrice: boolean;
  escrowPaymentBump: number;
  hasAuctioneer: boolean;
  auctioneerPdaBump: number;
};
