import {
  Keypair,
  PublicKey,
  SystemProgram,
  AccountInfo,
  clusterApiUrl,
  PublicKeyInitData,
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
import { AuctionHouseObject, CreateAuctionHouseArgs } from "./interfaces";
import { Program } from "@project-serum/anchor";
import {
  getAtaForMint,
  getAuctionHouse,
  getAuctionHouseFeeAccount,
  getAuctionHouseTreasuryAccount,
} from "./account";
import { ASSOCIATED_TOKEN_PROGRAM_ID, mintTo } from "@solana/spl-token";

const loadAuctionHouseProgram = async (
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

  //   console.log("idl => ", idl);

  return new anchor.Program(idl, AUCTION_HOUSE_PROGRAM_ID, provider);
};

export const createAuctionHouse = async (
  args: CreateAuctionHouseArgs
): Promise<PublicKey> => {
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

  console.log("payer wallet => ", walletKeyPair.publicKey.toBase58());

  // NOTE: do the rpc call to the anchor program (Auction house in this case)
  await anchorProgram.methods
    .createAuctionHouse(
      auctionHouseBump,
      feeAccountBump,
      treasuryAccountBump,
      sfbp,
      requiresSignOff,
      canChangeSalePrice
    )
    .accounts({
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
    })
    .signers([walletKeyPair])
    .rpc();

  console.log("Created auction house", auctionHouse.toBase58());

  return auctionHouse;
};

// get/create auction house key
const getAuctionHouseKey = async (
  auctionHouse: PublicKeyInitData,
  walletKeyPair: Keypair,
  tMintKey: anchor.web3.PublicKey
): Promise<anchor.web3.PublicKey> => {
  if (auctionHouse) {
    const ahKey: PublicKey = new anchor.web3.PublicKey(auctionHouse);
    return ahKey;
  } else {
    console.log(
      "No auction house explicitly passed in, assuming you are creator on it and deriving key..."
    );

    const ahKey: PublicKey = (
      await getAuctionHouse(walletKeyPair.publicKey, tMintKey)
    )[0];
    console.log(" getAuctionHouseKey  ahKey => ", ahKey);
    return ahKey;
  }
};

const getTokenAmount = async (
  anchorProgram: anchor.Program,
  account: anchor.web3.PublicKey,
  mint: anchor.web3.PublicKey
): Promise<number> => {
  // return depends on token type
  if (mint.equals(WRAPPED_SOL_MINT)) {
    // return amount in SOL
    return await anchorProgram.provider.connection.getBalance(account);
  } else {
    try {
      // return amount in SPL-TOKEN
      const token =
        await anchorProgram.provider.connection.getTokenAccountBalance(account);
      return token.value.uiAmount * Math.pow(10, token.value.decimals);
    } catch (error) {
      console.log("error in getTokenAmount =>", error.message);
      console.error(error);

      console.info(
        "Account ",
        account.toBase58(),
        "didnt return value. Assuming 0 tokens."
      );
    }
  }
};

export const showAuctionHouse = async ({
  keypair,
  env,
  auctionHouse,
  treasuryMint,
}: {
  keypair: Keypair;
  env: string;
  auctionHouse: PublicKeyInitData;
  treasuryMint: PublicKeyInitData;
}) => {
  console.log("----------- --------------------- ------------");
  console.log("----------- SHOWING AUCTION HOUSE ------------");
  console.log("----------- --------------------- ------------");
  try {
    const walletKeyPair = loadWalletKey(keypair.secretKey);
    const anchorProgram = await loadAuctionHouseProgram(walletKeyPair, env);

    let tMintKey: anchor.web3.PublicKey;

    if (treasuryMint) {
      tMintKey = new anchor.web3.PublicKey(treasuryMint);
    } else {
      console.info("No treasury mint detected, using SOL.");
      tMintKey = WRAPPED_SOL_MINT;
    }

    const auctionHouseKey: anchor.web3.PublicKey = await getAuctionHouseKey(
      auctionHouse,
      walletKeyPair,
      tMintKey
    );

    console.log(
      "showAuctionHouse | auctionHouseKey => ",
      auctionHouseKey.toBase58()
    );

    const auctionHouseObj: AuctionHouseObject =
      (await anchorProgram.account.auctionHouse.fetchNullable(
        auctionHouseKey
      )) as AuctionHouseObject;

    if (auctionHouseObj === null) {
      return null;
    }

    // console.log("auctionHouseObj => ", auctionHouseObj);

    const treasuryAmount = await getTokenAmount(
      anchorProgram,
      auctionHouseObj.auctionHouseTreasury,
      auctionHouseObj.treasuryMint
    );

    const feeAmount = await anchorProgram.provider.connection.getBalance(
      auctionHouseObj.auctionHouseFeeAccount
    );

    console.log("-----");
    console.log("Auction House:", auctionHouseKey.toBase58());
    console.log("Mint:", auctionHouseObj.treasuryMint.toBase58());
    console.log("Authority:", auctionHouseObj.authority.toBase58());
    console.log("Creator:", auctionHouseObj.creator.toBase58());
    console.log(
      "Fee Payer Acct:",
      auctionHouseObj.auctionHouseFeeAccount.toBase58()
    );
    console.log(
      "Treasury Acct:",
      auctionHouseObj.auctionHouseTreasury.toBase58()
    );
    console.log(
      "Fee Payer Withdrawal Acct:",
      auctionHouseObj.feeWithdrawalDestination.toBase58()
    );
    console.log(
      "Treasury Withdrawal Acct:",
      auctionHouseObj.treasuryWithdrawalDestination.toBase58()
    );

    console.log("Fee Payer Bal:", feeAmount);
    console.log("Treasury Bal:", treasuryAmount);
    console.log(
      "Seller Fee Basis Points:",
      auctionHouseObj.sellerFeeBasisPoints
    );
    console.log("Requires Sign Off:", auctionHouseObj.requiresSignOff);
    console.log("Can Change Sale Price:", auctionHouseObj.canChangeSalePrice);
    console.log("AH Bump:", auctionHouseObj.bump);
    console.log("AH Fee Bump:", auctionHouseObj.feePayerBump);
    console.log("AH Treasury Bump:", auctionHouseObj.treasuryBump);
  } catch (error) {
    console.log("error in showAuctionHouse => ", error.message);
    console.error(error);
  }
};
