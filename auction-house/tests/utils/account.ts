import * as anchor from "@project-serum/anchor";
import {
  AUCTION_HOUSE,
  AUCTION_HOUSE_PROGRAM_ID,
  FEE_PAYER,
  SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  TREASURY,
} from "./constants";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  AccountInfo,
  clusterApiUrl,
  Connection,
} from "@solana/web3.js";

export const getAtaForMint = async (
  mint: anchor.web3.PublicKey,
  buyer: anchor.web3.PublicKey
): Promise<[anchor.web3.PublicKey, number]> => {
  const ata = await anchor.web3.PublicKey.findProgramAddress(
    [buyer.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID
  );

  return ata;
};

export const getAuctionHouse = async (
  creator: anchor.web3.PublicKey,
  treasuryMint: anchor.web3.PublicKey
): Promise<[PublicKey, number]> => {
  try {
    const ah = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from(AUCTION_HOUSE), creator.toBuffer(), treasuryMint.toBuffer()],
      AUCTION_HOUSE_PROGRAM_ID
    );

    console.log("get auction house => ", ah);
    return ah;
  } catch (error) {
    console.log(" error in getAuctionHouse => ", error);
  }
};

export const getAuctionHouseFeeAccount = async (
  auctionHouse: anchor.web3.PublicKey
): Promise<[PublicKey, number]> => {
  const ahFeeAcct = await anchor.web3.PublicKey.findProgramAddress(
    [
      Buffer.from(AUCTION_HOUSE),
      auctionHouse.toBuffer(),
      Buffer.from(FEE_PAYER),
    ],
    AUCTION_HOUSE_PROGRAM_ID
  );

  return ahFeeAcct;
};

export const getAuctionHouseTreasuryAccount = async (
  auctionHouse: anchor.web3.PublicKey
): Promise<[PublicKey, number]> => {
  const ahTAcct = await anchor.web3.PublicKey.findProgramAddress(
    [
      Buffer.from(AUCTION_HOUSE),
      auctionHouse.toBuffer(),
      Buffer.from(TREASURY),
    ],
    AUCTION_HOUSE_PROGRAM_ID
  );

  return ahTAcct;
};

export const addSOLToWallet = async (wallet: Keypair) => {
  try {
    const network = clusterApiUrl("devnet");

    const connection = new Connection(network);
    const airdropSignature = await connection.requestAirdrop(
      wallet.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL // 10000000 Lamports in 1 SOL
    );

    const latestBlockHash = await connection.getLatestBlockhash();

    await connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: airdropSignature,
    });
  } catch (error) {
    console.error(error);
  }
};
