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
import {
  AuctionHouseObject,
  BuyAuctionHouseArgs,
  CancelAuctionHouseArgs,
  CreateAuctionHouseArgs,
  ExecuteSaleAuctionHouseArgs,
  PurchaseReceipt,
  remainingCreatorAccounts,
  SellAuctionHouseArgs,
  ShowEscrowArgs,
} from "./interfaces";
import { Program } from "@project-serum/anchor";
import {
  getAtaForMint,
  getAuctionHouse,
  getAuctionHouseBuyerEscrow,
  getAuctionHouseFeeAccount,
  getAuctionHouseProgramAsSigner,
  getAuctionHouseTradeState,
  getAuctionHouseTreasuryAccount,
  getMetadata,
  sendTransactionWithRetryWithKeypair,
} from "./account";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createApproveInstruction,
  createRevokeInstruction,
} from "@solana/spl-token";
import { BN } from "bn.js";
import { getPriceWithMantissa } from "./misc";
import { base58_to_binary } from "base58-js";
import { token } from "@project-serum/anchor/dist/cjs/utils";
import { decodeMetadata, Metadata } from "./schema";

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

export const sell = async (args: SellAuctionHouseArgs) => {
  const {
    keypair,
    env,
    auctionHouse,
    auctionHouseKeypair,
    buyPrice,
    mint,
    tokenSize,
    auctionHouseSigns, // NOTE: a boolean used to simulate the auction house changing the price without your sign off
  } = args;

  try {
    const auctionHouseKey = new anchor.web3.PublicKey(auctionHouse);
    const walletKeyPair = loadWalletKey(keypair.secretKey);
    const mintKey = new anchor.web3.PublicKey(mint);

    console.log("[sell] || auctionHouseKey => ", auctionHouseKey.toBase58());
    console.log(
      "[sell] || walletKeyPair => ",
      walletKeyPair.publicKey.toBase58()
    );
    console.log("[sell] || mintKey => ", mintKey.toBase58());

    const auctionHouseKeypairLoaded = auctionHouseKeypair
      ? loadWalletKey(auctionHouseKeypair.secretKey)
      : null;

    if (auctionHouseKeypair) {
      console.log(
        "[sell] || auctionHouseKeypairLoaded => ",
        auctionHouseKeypairLoaded.publicKey.toBase58()
      );
    }

    const anchorProgram = await loadAuctionHouseProgram(
      auctionHouseSigns ? auctionHouseKeypairLoaded : walletKeyPair,
      env
    );

    console.log(
      "[sell] || anchorProgram => ",
      anchorProgram.programId.toBase58()
    );

    const auctionHouseObj: AuctionHouseObject =
      (await anchorProgram.account.auctionHouse.fetchNullable(
        auctionHouseKey
      )) as AuctionHouseObject;

    console.log("[sell] || auctionHouseObj => ", auctionHouseObj);

    if (auctionHouseObj === null)
      throw new Error("auction house account not found");

    const priceFromBuyPrice = await getPriceWithMantissa(
      buyPrice,
      mintKey,
      walletKeyPair,
      anchorProgram
    );

    const buyPriceAdjusted = new BN(priceFromBuyPrice);

    console.log("[sell] || buyPriceAdjusted => ", buyPriceAdjusted.toNumber());

    const priceFromTokenSize = await getPriceWithMantissa(
      tokenSize,
      mintKey,
      walletKeyPair,
      anchorProgram
    );

    const tokenSizeAdjusted = new BN(priceFromTokenSize);

    console.log(
      "[sell] || tokenSizeAdjusted => ",
      tokenSizeAdjusted.toNumber()
    );

    const tokenAccountKey: anchor.web3.PublicKey =
      await getAssociatedTokenAddress(mintKey, keypair.publicKey);

    console.log("[sell] || tokenAccountKey => ", tokenAccountKey.toBase58());

    const [programAsSigner, programAsSignerBump] =
      await getAuctionHouseProgramAsSigner();

    console.log(
      "[sell] || programAsSigner => ",
      programAsSigner.toBase58(),
      " with bump value of ",
      programAsSignerBump
    );

    console.log("[sell] || tradestate seeds => ", {
      auctionHouse: auctionHouseKey,
      wallet: walletKeyPair.publicKey,
      tokenAccount: tokenAccountKey,
      treasuryMint: auctionHouseObj.treasuryMint,
      tokenMint: mintKey,
      tokenSize: tokenSizeAdjusted,
      buyPrice: buyPriceAdjusted,
    });

    const [tradeState, tradeStateBump] = await getAuctionHouseTradeState({
      auctionHouse: auctionHouseKey,
      wallet: walletKeyPair.publicKey,
      tokenAccount: tokenAccountKey,
      treasuryMint: auctionHouseObj.treasuryMint,
      tokenMint: mintKey,
      tokenSize: tokenSizeAdjusted,
      buyPrice: buyPriceAdjusted,
    });

    console.log(
      "[sell] || tradeState => ",
      tradeState.toBase58(),
      " with bump value of ",
      tradeStateBump
    );

    const [freeTradeState, freeTradeStateBump] =
      await getAuctionHouseTradeState({
        auctionHouse: auctionHouseKey,
        wallet: walletKeyPair.publicKey,
        tokenAccount: tokenAccountKey,
        treasuryMint: auctionHouseObj.treasuryMint,
        tokenMint: mintKey,
        tokenSize: tokenSizeAdjusted,
        buyPrice: new BN(0),
      });

    console.log(
      "[sell] || freeTradeState => ",
      freeTradeState.toBase58(),
      " with bump value of ",
      freeTradeStateBump
    );

    const metadataFromMintKey = (await getMetadata(mintKey))[0];

    console.log(
      "[sell] || metadataFromMintKey => ",
      metadataFromMintKey.toBase58()
    );

    const instruction: anchor.web3.TransactionInstruction =
      await anchorProgram.methods
        .sell(
          tradeStateBump,
          freeTradeStateBump,
          programAsSignerBump,
          buyPriceAdjusted,
          tokenSizeAdjusted
        )
        .accounts({
          wallet: walletKeyPair.publicKey,
          tokenAccount: tokenAccountKey,
          metadata: metadataFromMintKey,
          authority: auctionHouseObj.authority,
          auctionHouse: auctionHouseKey,
          auctionHouseFeeAccount: auctionHouseObj.auctionHouseFeeAccount,
          sellerTradeState: tradeState,
          freeSellerTradeState: freeTradeState,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          programAsSigner: programAsSigner,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .instruction();

    // update the instruction accordingly
    console.log("[sell] || instruction => ", instruction);

    const signers: Keypair[] = [];

    if (auctionHouseKeypairLoaded) {
      signers.push(auctionHouseKeypairLoaded);
    }

    if (auctionHouseSigns) {
      // NOTE: Essentially makes the auction house keypair be the signer if the `auctionHousSigns` is true
      instruction.keys
        .filter((k) => k.pubkey.equals(auctionHouseKeypairLoaded.publicKey))
        .map((k) => (k.isSigner = true));
    } else {
      // NOTE: and make the wallet be the signer if the opposite happens
      instruction.keys
        .filter((k) => k.pubkey.equals(walletKeyPair.publicKey))
        .map((k) => (k.isSigner = true));
    }

    console.log("[sell] || adjusted instruction => ", instruction);

    await sendTransactionWithRetryWithKeypair({
      connection: anchorProgram.provider.connection,
      wallet: auctionHouseSigns ? auctionHouseKeypairLoaded : walletKeyPair,
      instructions: [instruction],
      signers: signers,
      commitment: "max",
      includeFeePayer: false,
    });

    console.log(
      "Set",
      tokenSize,
      mint.toBase58(),
      "for sale for",
      buyPrice,
      "from your account with Auction House",
      auctionHouse.toBase58()
    );
    var output = {
      mintAddress: mint,
      price: buyPrice,
      account: auctionHouse,
      tokenAccountKey,
    };
    return output;
  } catch (error) {
    console.log("error in [sell] =>", error.message);
    console.error("error in [sell] =>", error);
  }
};

export const buy = async (args: BuyAuctionHouseArgs) => {
  const {
    keypair,
    env,
    auctionHouse,
    auctionHouseKeypair,
    buyPrice,
    mint,
    tokenSize,
    tokenAccount,
  } = args;

  const auctionHouseKey = new anchor.web3.PublicKey(auctionHouse);
  const walletKeyPair = loadWalletKey(keypair.secretKey);

  const mintKey = new anchor.web3.PublicKey(mint);

  console.log("[buy] || auctionHouseKey => ", auctionHouseKey.toBase58());
  console.log("[buy] || walletKeyPair => ", walletKeyPair.publicKey.toBase58());
  console.log("[buy] || mintKey => ", mintKey.toBase58());

  const auctionHouseKeypairLoaded = auctionHouseKeypair
    ? loadWalletKey(auctionHouseKeypair.secretKey)
    : (null as any);

  const anchorProgram = await loadAuctionHouseProgram(walletKeyPair, env);
  const auctionHouseObj = (await anchorProgram.account.auctionHouse.fetch(
    auctionHouseKey
  )) as AuctionHouseObject;

  if (auctionHouseKeypair) {
    console.log(
      "[buy] || auctionHouseKeypairLoaded => ",
      auctionHouseKeypairLoaded.publicKey.toBase58()
    );
  }

  console.log("[buy] || auctionHouseObj => ", auctionHouseObj);

  const buyPriceAdjusted = new BN(
    await getPriceWithMantissa(
      buyPrice,
      auctionHouseObj.treasuryMint,
      walletKeyPair,
      anchorProgram
    )
  );

  const tokenSizeAdjusted = new BN(
    await getPriceWithMantissa(tokenSize, mintKey, walletKeyPair, anchorProgram)
  );

  console.log("[buy] || buyPriceAdjusted => ", buyPriceAdjusted);
  console.log("[buy] || tokenSizeAdjusted => ", tokenSizeAdjusted);

  const [escrowPaymentAccount, escrowPaymentAccountBump] =
    await getAuctionHouseBuyerEscrow(auctionHouseKey, walletKeyPair.publicKey);

  const results =
    await anchorProgram.provider.connection.getTokenLargestAccounts(mintKey);

  const tokenAccountKey = tokenAccount
    ? new anchor.web3.PublicKey(tokenAccount)
    : results.value[0].address;

  const [tradeStateAddress, tradeStateBump] = await getAuctionHouseTradeState({
    auctionHouse: auctionHouseKey,
    wallet: walletKeyPair.publicKey,
    tokenAccount: tokenAccountKey,
    treasuryMint: auctionHouseObj.treasuryMint,
    tokenMint: mintKey,
    tokenSize: tokenSizeAdjusted,
    buyPrice: buyPriceAdjusted,
  });

  console.log(
    "[buy] || [escrowPaymentAccount, escrowPaymentAccountBump] => ",
    escrowPaymentAccount.toBase58(),
    escrowPaymentAccountBump
  );
  console.log("[buy] || results => ", results.value[0]);
  console.log("[buy] || tokenAccountKey => ", tokenAccountKey.toBase58());
  console.log(
    "[buy] || [tradeStateAddress, tradeStateBump] => ",
    tradeStateAddress.toBase58(),
    tradeStateBump
  );

  const isNative = auctionHouseObj.treasuryMint.equals(WRAPPED_SOL_MINT);

  const ata = (
    await getAtaForMint(auctionHouseObj.treasuryMint, walletKeyPair.publicKey)
  )[0];

  const transferAuthority = anchor.web3.Keypair.generate();
  const signers = isNative ? [] : [transferAuthority];

  console.log("[buy] || isNative => ", isNative);
  console.log("[buy] || ata => ", ata.toBase58());
  console.log("[buy] || signers => ", signers);

  // NOTE: execute `buy` instruction
  const instruction: anchor.web3.TransactionInstruction =
    await anchorProgram.methods
      .buy(
        tradeStateBump,
        escrowPaymentAccountBump,
        buyPriceAdjusted,
        tokenSizeAdjusted
      )
      .accounts({
        wallet: walletKeyPair.publicKey,
        paymentAccount: isNative ? walletKeyPair.publicKey : ata,
        transferAuthority: isNative
          ? anchor.web3.SystemProgram.programId
          : transferAuthority.publicKey,
        treasuryMint: auctionHouseObj.treasuryMint,
        tokenAccount: tokenAccountKey,
        metadata: (await getMetadata(mintKey))[0],
        authority: auctionHouseObj.authority,
        escrowPaymentAccount: escrowPaymentAccount,
        auctionHouse: auctionHouse,
        auctionHouseFeeAccount: auctionHouseObj.auctionHouseFeeAccount,
        buyerTradeState: tradeStateAddress,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .instruction();

  console.log("[buy] || instruction => ", instruction);

  if (auctionHouseKeypairLoaded) {
    signers.push(auctionHouseKeypairLoaded);

    instruction.keys
      .filter((key) => key.pubkey.equals(auctionHouseKeypairLoaded.publicKey))
      .map((key) => (key.isSigner = true));
  }

  if (!isNative) {
    instruction.keys
      .filter((key) => key.pubkey.equals(transferAuthority.publicKey))
      .map((key) => (key.isSigner = true));
  }

  const instructions = [
    ...(isNative
      ? []
      : [
          createApproveInstruction(
            ata,
            transferAuthority.publicKey,
            walletKeyPair.publicKey,
            buyPriceAdjusted.toNumber(),
            [],
            TOKEN_PROGRAM_ID
          ),
        ]),
    instruction,
    ...(isNative
      ? []
      : [
          createRevokeInstruction(
            ata,
            walletKeyPair.publicKey,
            [],
            TOKEN_PROGRAM_ID
          ),
        ]),
  ];

  const { txid, slot } = await sendTransactionWithRetryWithKeypair({
    commitment: "max",
    connection: anchorProgram.provider.connection,
    wallet: walletKeyPair,
    instructions: instructions,
    signers: signers,
    includeFeePayer: false,
  });

  console.log("[buy] || { txid, slot } ", { txid, slot });

  console.log("[buy] || Made offer for ", buyPrice);
  return buyPrice;
};

export const executeSale = async (
  args: ExecuteSaleAuctionHouseArgs
): Promise<PurchaseReceipt> => {
  const {
    keypair,
    env,
    auctionHouse,
    auctionHouseKeypair,
    buyPrice,
    mint,
    tokenSize,
    auctionHouseSigns,
    buyerWallet,
    sellerWallet,
  } = args;

  const auctionHouseKey = new anchor.web3.PublicKey(auctionHouse);
  const walletKeyPair = loadWalletKey(keypair.secretKey);
  const mintKey = new anchor.web3.PublicKey(mint);

  const auctionHouseKeypairLoaded = auctionHouseKeypair
    ? loadWalletKey(auctionHouseKeypair.secretKey)
    : (null as any);

  if (auctionHouseKeypair) {
    console.log(
      "[executeSale] || auctionHouseKeypairLoaded ",
      auctionHouseKeypairLoaded.publicKey.toBase58()
    );
  }

  console.log(
    "[executeSale] || auctionHouseKey => ",
    auctionHouseKey.toBase58()
  );
  console.log(
    "[executeSale] || walletKeyPair => ",
    walletKeyPair.publicKey.toBase58()
  );
  console.log("[executeSale] || mintKey => ", mintKey.toBase58());

  const anchorProgram = await loadAuctionHouseProgram(
    auctionHouseSigns ? auctionHouseKeypairLoaded : walletKeyPair,
    env
  );

  const auctionHouseObj = (await anchorProgram.account.auctionHouse.fetch(
    auctionHouseKey
  )) as AuctionHouseObject;
  const buyerWalletKey = new anchor.web3.PublicKey(buyerWallet);
  const sellerWalletKey = new anchor.web3.PublicKey(sellerWallet);

  console.log(
    "[executeSale] || anchorProgram => ",
    anchorProgram.programId.toBase58()
  );
  console.log(
    "[executeSale] || auctionHouseObj => ",
    auctionHouseObj.authority.toBase58()
  );
  console.log("[executeSale] || buyerWalletKey => ", buyerWalletKey.toBase58());
  console.log(
    "[executeSale] || sellerWalletKey => ",
    sellerWalletKey.toBase58()
  );

  const isNative = auctionHouseObj.treasuryMint.equals(WRAPPED_SOL_MINT);
  const buyPriceAdjusted = new BN(
    await getPriceWithMantissa(
      buyPrice,
      auctionHouseObj.treasuryMint,
      walletKeyPair,
      anchorProgram
    )
  );

  const sellPriceAdjusted = new BN(
    await getPriceWithMantissa(buyPrice, mintKey, walletKeyPair, anchorProgram)
  );

  const tokenSizeAdjusted = new BN(
    await getPriceWithMantissa(tokenSize, mintKey, walletKeyPair, anchorProgram)
  );

  const tokenAccountKey = await getAssociatedTokenAddress(
    mintKey,
    sellerWalletKey
  );

  console.log("[executeSale] || isNative => ", isNative);
  console.log(
    "[executeSale] || buyPriceAdjusted => ",
    buyPriceAdjusted.toNumber()
  );
  console.log(
    "[executeSale] || tokenSizeAdjusted => ",
    tokenSizeAdjusted.toNumber()
  );
  console.log(
    "[executeSale] || tokenAccountKey => ",
    tokenAccountKey.toBase58()
  );

  const buyerTradeState = (
    await getAuctionHouseTradeState({
      auctionHouse: auctionHouseKey,
      buyPrice: buyPriceAdjusted,
      tokenAccount: tokenAccountKey,
      tokenMint: mintKey,
      tokenSize: tokenSizeAdjusted,
      treasuryMint: auctionHouseObj.treasuryMint,
      wallet: buyerWalletKey,
    })
  )[0];

  console.log("[execute sale] seller seeds => ", {
    auctionHouse: auctionHouseKey,
    buyPrice: buyPriceAdjusted,
    tokenAccount: tokenAccountKey,
    tokenMint: mintKey,
    tokenSize: tokenSizeAdjusted,
    treasuryMint: auctionHouseObj.treasuryMint,
    wallet: sellerWalletKey,
  });

  const [sellerTradeState, sellerTradeStateBump] =
    await getAuctionHouseTradeState({
      auctionHouse: auctionHouseKey,
      buyPrice: sellPriceAdjusted,
      tokenAccount: tokenAccountKey,
      tokenMint: mintKey,
      tokenSize: tokenSizeAdjusted,
      treasuryMint: auctionHouseObj.treasuryMint,
      wallet: sellerWalletKey,
    });

  const [freeTradeState, freeTradeStateBump] = await getAuctionHouseTradeState({
    auctionHouse: auctionHouseKey,
    buyPrice: new BN(0),
    tokenAccount: tokenAccountKey,
    tokenMint: mintKey,
    tokenSize: tokenSizeAdjusted,
    treasuryMint: auctionHouseObj.treasuryMint,
    wallet: sellerWalletKey,
  });

  const [escrowPaymentAccount, escrowPaymentAccountBump] =
    await getAuctionHouseBuyerEscrow(auctionHouseKey, buyerWalletKey);

  const [programAsSigner, programAsSignerBump] =
    await getAuctionHouseProgramAsSigner();

  console.log(
    "[executeSale] || buyerTradeState => ",
    buyerTradeState.toBase58()
  );
  console.log("[executeSale] || [sellerTradeState, sellerTradeStateBump] => ", [
    sellerTradeState.toBase58(),
    sellerTradeStateBump,
  ]);
  console.log("[executeSale] || [freeTradeState, freeTradeStateBump] => ", [
    freeTradeState.toBase58(),
    freeTradeStateBump,
  ]);
  console.log(
    "[executeSale] || [escrowPaymentAccount, escrowPaymentAccountBump] => ",
    [escrowPaymentAccount.toBase58(), escrowPaymentAccountBump]
  );
  console.log("[executeSale] || [programAsSigner, programAsSignerBump] => ", [
    programAsSigner.toBase58(),
    programAsSignerBump,
  ]);

  const metadata = await getMetadata(mintKey);
  const metadataObj = await anchorProgram.provider.connection.getAccountInfo(
    metadata[0]
  );

  console.log("[executeSale] || metadata => ", metadata[0].toBase58());

  console.log("[executeSale] || metadataObj => ", metadataObj);

  // NOTE: gather all remaining accounts from metadata
  const metadataDecoded = decodeMetadata(
    Buffer.from(metadataObj!.data)
  ) as Metadata;
  const remainingAccounts: remainingCreatorAccounts[] = [];

  console.log("[executeSale] || metadataDecoded => ", metadataDecoded);

  for (let i = 0; i < metadataDecoded!.data!.creators!.length; i++) {
    let creatorAddress = new anchor.web3.PublicKey(
      metadataDecoded.data.creators[i].address
    );

    remainingAccounts.push({
      pubkey: creatorAddress,
      isWritable: true,
      isSigner: false,
    });

    if (!isNative) {
      const remainingAccountAta: anchor.web3.PublicKey = (
        await getAtaForMint(
          auctionHouseObj.treasuryMint,
          remainingAccounts[remainingAccounts.length - 1].pubkey
        )
      )[0];
      remainingAccounts.push({
        pubkey: remainingAccountAta,
        isWritable: true,
        isSigner: false,
      });
    }
  }

  const signers: Keypair[] = [];

  const instruction = await anchorProgram.methods
    .executeSale(
      escrowPaymentAccountBump,
      freeTradeStateBump,
      programAsSignerBump,
      sellerTradeStateBump,
      buyPriceAdjusted,
      tokenSizeAdjusted
    )
    .accounts({
      buyer: buyerWalletKey,
      seller: sellerWalletKey,
      tokenAccount: tokenAccountKey,
      tokenMint: mintKey,
      metadata: metadata[0],
      treasuryMint: auctionHouseObj.treasuryMint,
      escrowPaymentAccount: escrowPaymentAccount,
      sellerPaymentReceiptAccount: isNative
        ? sellerWalletKey
        : (
            await getAtaForMint(auctionHouseObj.treasuryMint, sellerWalletKey)
          )[0],
      buyerReceiptTokenAccount: (
        await getAtaForMint(mintKey, buyerWalletKey)
      )[0],
      authority: auctionHouseObj.authority,
      auctionHouse: auctionHouseKey,
      auctionHouseFeeAccount: auctionHouseObj.auctionHouseFeeAccount,
      auctionHouseTreasury: auctionHouseObj.auctionHouseTreasury,
      buyerTradeState: buyerTradeState,
      sellerTradeState: sellerTradeState,
      freeTradeState: freeTradeState,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
      ataProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      programAsSigner: programAsSigner,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    })
    .signers(signers)
    .remainingAccounts(remainingAccounts)
    .instruction();

  console.log("[executeSale] || instruction => ", instruction);

  if (auctionHouseKeypairLoaded) {
    signers.push(auctionHouseKeypairLoaded);

    instruction.keys
      .filter((key) => key.pubkey.equals(auctionHouseKeypairLoaded.publicKey))
      .map((key) => (key.isSigner = true));
  }

  if (!auctionHouseSigns) {
    instruction.keys
      .filter((key) => key.pubkey.equals(walletKeyPair.publicKey))
      .map((key) => (key.isSigner = true));
  }

  const { txid, slot } = await sendTransactionWithRetryWithKeypair({
    commitment: "max",
    connection: anchorProgram.provider.connection,
    includeFeePayer: false,
    instructions: [instruction],
    signers: signers,
    wallet: auctionHouseSigns ? auctionHouseKeypairLoaded : walletKeyPair,
  });

  console.log(
    "[executeSale] || SUMMARY => ",
    "Accepted",
    tokenSize,
    mint,
    "sale from wallet",
    sellerWalletKey.toBase58(),
    "to",
    buyerWalletKey.toBase58(),
    "for",
    buyPrice,
    "from your account with Auction House",
    auctionHouse
  );

  console.log("[executeSale] || { txid, slot } => ", { txid, slot });

  const purchaseReceipt: PurchaseReceipt = {
    auctionHouseAccount: auctionHouse,
    fromWallet: sellerWallet,
    toWallet: buyerWallet,
    mintAddress: mint,
    price: buyPriceAdjusted.toNumber(),
  };
  return purchaseReceipt;
};

export const cancel = async (
  args: CancelAuctionHouseArgs
): Promise<{ txid: string; slot: number }> => {
  const {
    keypair,
    env,
    auctionHouse,
    auctionHouseKeypair,
    buyPrice,
    mint,
    tokenSize,
    auctionHouseSigns,
    sellerWalletKeypair,
  } = args;

  const auctionHouseKey = new anchor.web3.PublicKey(auctionHouse);
  const walletKeyPair = loadWalletKey(keypair.secretKey);
  const mintKey = new anchor.web3.PublicKey(mint);

  console.log("[cancel] || auctionHouseKey => ", auctionHouseKey.toBase58());
  console.log(
    "[cancel] || walletKeyPair => ",
    walletKeyPair.publicKey.toBase58()
  );
  console.log("[cancel] || mintKey => ", mintKey.toBase58());

  const auctionHouseKeypairLoaded = auctionHouseKeypair
    ? loadWalletKey(auctionHouseKeypair.secretKey)
    : (null as any);

  const anchorProgram = await loadAuctionHouseProgram(
    auctionHouseSigns ? auctionHouseKeypairLoaded : walletKeyPair,
    env
  );

  const auctionHouseObj = (await anchorProgram.account.auctionHouse.fetch(
    auctionHouseKey
  )) as AuctionHouseObject;

  const buyPriceAdjusted = new BN(
    await getPriceWithMantissa(
      buyPrice,
      auctionHouseObj.treasuryMint,
      walletKeyPair,
      anchorProgram
    )
  );

  const tokenSizeAdjusted = new BN(
    await getPriceWithMantissa(tokenSize, mintKey, walletKeyPair, anchorProgram)
  );

  const tokenAccountKey: anchor.web3.PublicKey =
    await getAssociatedTokenAddress(mintKey, sellerWalletKeypair.publicKey);

  const tradeState = (
    await getAuctionHouseTradeState({
      auctionHouse: auctionHouseKey,
      buyPrice: buyPriceAdjusted,
      tokenAccount: tokenAccountKey,
      tokenMint: mintKey,
      tokenSize: tokenSizeAdjusted,
      treasuryMint: auctionHouseObj.treasuryMint,
      wallet: walletKeyPair.publicKey,
    })
  )[0];

  const signers: Keypair[] = [];

  const instruction = await anchorProgram.methods
    .cancel(buyPriceAdjusted, tokenSizeAdjusted)
    .accounts({
      wallet: walletKeyPair.publicKey,
      tokenAccount: tokenAccountKey,
      tokenMint: mintKey,
      authority: auctionHouseObj.authority,
      auctionHouse: auctionHouseKey,
      auctionHouseFeeAccount: auctionHouseObj.auctionHouseFeeAccount,
      tradeState: tradeState,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers(signers)
    .instruction();

  if (auctionHouseKeypairLoaded) {
    signers.push(auctionHouseKeypairLoaded);

    instruction.keys
      .filter((k) => k.pubkey.equals(auctionHouseKeypairLoaded.publicKey))
      .map((k) => (k.isSigner = true));
  }

  if (!auctionHouseSigns) {
    instruction.keys
      .filter((k) => k.pubkey.equals(walletKeyPair.publicKey))
      .map((k) => (k.isSigner = true));
  }

  const { txid, slot } = await sendTransactionWithRetryWithKeypair({
    commitment: "max",
    connection: anchorProgram.provider.connection,
    includeFeePayer: false,
    instructions: [instruction],
    signers: signers,
    wallet: auctionHouseSigns ? auctionHouseKeypairLoaded : walletKeyPair,
  });

  console.log("[cancel] || { txid, slot } => ", { txid, slot });

  return { txid, slot };
};

export const showEscrow = async (args: ShowEscrowArgs) => {
  const { auctionHouse, env, keypair } = args;

  const wallet = loadWalletKey(keypair.secretKey);
  const anchorProgram = await loadAuctionHouseProgram(wallet, env);
  const auctionHouseKey = new anchor.web3.PublicKey(auctionHouse);
  const auctionHouseObj = (await anchorProgram.account.auctionHouse.fetch(
    auctionHouseKey
  )) as AuctionHouseObject;

  const escrow = (
    await getAuctionHouseBuyerEscrow(auctionHouseKey, wallet.publicKey)
  )[0];

  const amount = await getTokenAmount(
    anchorProgram,
    escrow,
    auctionHouseObj.treasuryMint
  );

  console.log(
    `[showEscrow] The tokens residing in escrow ${escrow.toBase58()} are ${amount}`
  );
};
