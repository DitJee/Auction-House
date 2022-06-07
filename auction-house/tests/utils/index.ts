import {
  Keypair,
  PublicKey,
  SystemProgram,
  AccountInfo,
  clusterApiUrl,
} from "@solana/web3.js";

import * as anchor from "@project-serum/anchor";
import {
  AUCTION_HOUSE,
  AUCTION_HOUSE_PROGRAM_ID,
  AUCTION_HOUSE_PROGRAM_ID_STRING,
  Cluster,
  FEE_PAYER,
  loadWalletKey,
  SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  WRAPPED_SOL_MINT,
} from "./constants";
import { CreateAuctionHouseArgs } from "./interfaces";
import { Program } from "@project-serum/anchor";
import {
  getAtaForMint,
  getAuctionHouse,
  getAuctionHouseFeeAccount,
  getAuctionHouseTreasuryAccount,
} from "./account";
import { ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";

export const loadAuctionHouseProgram = async (
  walletKeyPair: Keypair,
  env: string,
  customRpcUrl?: string
): Promise<anchor.Program> => {
  if (customRpcUrl) console.log("USING CUSTOM URL", customRpcUrl);

  const walletWrapper = new anchor.Wallet(walletKeyPair);

  //FIXME: Need to link `env` to connection creation
  console.log("deployment env => ", env);

  const connection = new anchor.web3.Connection(
    anchor.web3.clusterApiUrl("devnet"),
    "confirmed"
  );
  const provider = new anchor.AnchorProvider(connection, walletWrapper, {
    preflightCommitment: "confirmed",
  });

  console.log("fetching IDL using program ID => ", AUCTION_HOUSE_PROGRAM_ID);
  const idl = await anchor.Program.fetchIdl(AUCTION_HOUSE_PROGRAM_ID, provider);

  console.log("idl => ", idl);

  return new anchor.Program(idl, AUCTION_HOUSE_PROGRAM_ID, provider);
};

export const createAuctionHouse = async (args: CreateAuctionHouseArgs) => {
  // NOTE: extract all input args
  const walletKeyPair = args.keypair;
  const env = args.env;
  const treasuryWithdrawalDestination = args.treasuryWithdrawalDestination;
  const feeWithdrawalDestination = args.feeWithdrawalDestination;
  const treasuryMint = args.treasuryMint;
  const sfbp = args.sellerFeeBasisPoints;
  const requiresSignOff = args.requiresSignOff;
  const canChangeSalePrice = args.canChangeSalePrice;

  // NOTE: get the program instance
  const anchorProgram: Program = await loadAuctionHouseProgram(
    walletKeyPair,
    env
  );

  console.log("anchorprogram =>", anchorProgram);

  // NOTE: assign pubkeys
  let twdKey: anchor.web3.PublicKey;
  let fwdKey: anchor.web3.PublicKey;
  let tMintKey: anchor.web3.PublicKey;
  if (!treasuryWithdrawalDestination) {
    console.log("No treasury withdrawal dest detected, using keypair");
    twdKey = walletKeyPair.publicKey;
  } else {
    twdKey = new anchor.web3.PublicKey(treasuryWithdrawalDestination);
  }

  console.log("twdKey => ", twdKey);

  if (!feeWithdrawalDestination) {
    console.log("No fee withdrawal dest detected, using keypair");
    fwdKey = walletKeyPair.publicKey;
  } else {
    fwdKey = new anchor.web3.PublicKey(feeWithdrawalDestination);
  }

  console.log("fwdKey => ", fwdKey);

  if (!treasuryMint) {
    console.log("No treasury mint detected, using SOL.");
    tMintKey = WRAPPED_SOL_MINT;
  } else {
    tMintKey = new anchor.web3.PublicKey(treasuryMint);
  }

  console.log("tMintKey => ", tMintKey);

  const twdAta = tMintKey.equals(WRAPPED_SOL_MINT)
    ? twdKey
    : (await getAtaForMint(tMintKey, twdKey))[0];

  console.log("twdAta => ", twdAta);

  const [auctionHouse, auctionHouseBump] = await getAuctionHouse(
    walletKeyPair.publicKey,
    tMintKey
  );

  console.log(
    "return values from getAuctionHouse => ",
    auctionHouse,
    auctionHouseBump
  );

  const [feeAccount, feeAccountBump] = await getAuctionHouseFeeAccount(
    auctionHouse
  );

  console.log(
    "return values from getAuctionHouseFeeAccount => ",
    feeAccount,
    feeAccountBump
  );

  const [treasuryAccount, treasuryAccountBump] =
    await getAuctionHouseTreasuryAccount(auctionHouse);

  console.log(
    "return values from getAuctionHouseTreasuryAccount => ",
    treasuryAccount,
    treasuryAccountBump
  );

  // NOTE: do the rpc call to the anchor program (Auction house in this case)
  await anchorProgram.methods.createAuctionHouse(
    // -----
    // Arguments
    // -----
    auctionHouseBump,
    feeAccountBump,
    treasuryAccountBump,
    sfbp,
    requiresSignOff,
    canChangeSalePrice,
    // -----
    // Account struct
    // -----
    {
      accounts: {
        treasuryMint: tMintKey,
        payer: walletKeyPair.publicKey,
        authority: walletKeyPair.publicKey,
        feeWithdrawalDestination: fwdKey,
        treasuryWithdrawalDestination: twdAta,
        treasuryWithdrawalDestinationOwner: twdKey,
        auctionHouse,
        auctionHouseFeeAccount: feeAccount,
        auctionHouseTreasury: treasuryAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        ataProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      },
    }
  );

  console.log("Created auction house", auctionHouse.toBase58());
  return auctionHouse.toBase58();
};
