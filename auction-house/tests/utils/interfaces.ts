import {
  PublicKeyInitData,
  Keypair,
  TransactionInstruction,
  Blockhash,
  FeeCalculator,
} from "@solana/web3.js";
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

export type SellAuctionHouseArgs = {
  keypair: Keypair;
  env: string;
  auctionHouse: anchor.web3.PublicKey;
  auctionHouseKeypair: anchor.web3.Keypair;
  buyPrice: number;
  mint: anchor.web3.PublicKey;
  tokenSize: number;
  auctionHouseSigns: boolean;
};

export type AuctionHouseTradeStateSeeds = {
  auctionHouse: anchor.web3.PublicKey;
  wallet: anchor.web3.PublicKey;
  tokenAccount: anchor.web3.PublicKey;
  treasuryMint: anchor.web3.PublicKey;
  tokenMint: anchor.web3.PublicKey;
  tokenSize: anchor.BN;
  buyPrice: anchor.BN;
};

interface BlockhashAndFeeCalculator {
  blockhash: Blockhash;
  feeCalculator: FeeCalculator;
}
export interface RetryWithKeypairArgs {
  connection: anchor.web3.Connection;
  wallet: anchor.web3.Keypair;
  instructions: TransactionInstruction[];
  signers: anchor.web3.Keypair[];
  commitment: anchor.web3.Commitment;
  includeFeePayer: boolean;
  block?: BlockhashAndFeeCalculator;
  beforeSend?: () => void;
}

export type SignedTransactionArgs = {
  signedTransaction: anchor.web3.Transaction;
  connection: anchor.web3.Connection;
  sendingMessage?: string;
  sentMessgae?: string;
  successMessage?: string;
  timeout?: number;
};

export type BuyAuctionHouseArgs = {
  keypair: Keypair;
  env: string;
  auctionHouse: anchor.web3.PublicKey;
  auctionHouseKeypair: anchor.web3.Keypair;
  buyPrice: number;
  mint: anchor.web3.PublicKey;
  tokenSize: number;
  tokenAccount: anchor.web3.PublicKey;
};

export type ExecuteSaleAuctionHouseArgs = {
  keypair: Keypair;
  env: string;
  auctionHouse: anchor.web3.PublicKey;
  auctionHouseKeypair: anchor.web3.Keypair;
  buyPrice: number;
  mint: anchor.web3.PublicKey;
  tokenSize: number;
  auctionHouseSigns: boolean;
  buyerWallet: anchor.web3.PublicKey;
  sellerWallet: anchor.web3.PublicKey;
};

export type remainingCreatorAccounts = {
  pubkey: anchor.web3.PublicKey;
  isWritable: boolean;
  isSigner: boolean;
};

export type PurchaseReceipt = {
  mintAddress: anchor.web3.PublicKey;
  fromWallet: anchor.web3.PublicKey;
  toWallet: anchor.web3.PublicKey;
  price: number;
  auctionHouseAccount: anchor.web3.PublicKey;
};

export type CancelAuctionHouseArgs = {
  keypair: Keypair;
  env: string;
  auctionHouse: anchor.web3.PublicKey;
  auctionHouseKeypair: anchor.web3.Keypair;
  buyPrice: number;
  mint: anchor.web3.PublicKey;
  tokenSize: number;
  auctionHouseSigns: boolean;
  sellerWalletKeypair: anchor.web3.Keypair;
};

export type ShowEscrowArgs = {
  keypair: Keypair;
  env: string;
  auctionHouse: anchor.web3.PublicKey;
};
