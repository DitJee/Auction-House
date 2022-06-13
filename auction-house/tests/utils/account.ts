import * as anchor from "@project-serum/anchor";
import {
  AUCTION_HOUSE,
  AUCTION_HOUSE_PROGRAM_ID,
  AUCTION_HOUSE_PROGRAM_ID_STRING,
  FEE_PAYER,
  METADATA,
  SIGNER,
  SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
  TOKEN_METADATA_PROGRAM_ID,
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
  SignatureStatus,
} from "@solana/web3.js";
import {
  AuctionHouseTradeStateSeeds,
  RetryWithKeypairArgs,
  SignedTransactionArgs,
} from "./interfaces";
import { createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import { getUnixTs, sleep } from "./misc";

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

export const getAuctionHouseProgramAsSigner = async (): Promise<
  [PublicKey, number]
> => {
  try {
    const auctionHouseProgramAsSignerAddress: [anchor.web3.PublicKey, number] =
      await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from(AUCTION_HOUSE), Buffer.from(SIGNER)],
        AUCTION_HOUSE_PROGRAM_ID
      );

    return auctionHouseProgramAsSignerAddress;
  } catch (error) {
    throw new Error("cannot find getAuctionHouseProgramAsSigner address");
  }
};

export const getAuctionHouseTradeState = async (
  seeds: AuctionHouseTradeStateSeeds
): Promise<[PublicKey, number]> => {
  try {
    const auctionHouseTradeStateAddress: [anchor.web3.PublicKey, number] =
      await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from(AUCTION_HOUSE),
          seeds.wallet.toBuffer(),
          seeds.auctionHouse.toBuffer(),
          seeds.tokenAccount.toBuffer(),
          seeds.treasuryMint.toBuffer(),
          seeds.tokenMint.toBuffer(),
          seeds.buyPrice.toBuffer("le", 8),
          seeds.tokenSize.toBuffer("le", 8),
        ],
        AUCTION_HOUSE_PROGRAM_ID
      );

    return auctionHouseTradeStateAddress;
  } catch (error) {
    throw new Error("cannot find getAuctionHouseTradeState address");
  }
};

export const getMetadata = async (
  mint: anchor.web3.PublicKey
): Promise<[anchor.web3.PublicKey, number]> => {
  const metadataAddress = await anchor.web3.PublicKey.findProgramAddress(
    [
      Buffer.from(METADATA),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );

  return metadataAddress;
};

export const sendTransactionWithRetryWithKeypair = async (
  retryArgs: RetryWithKeypairArgs
) => {
  // NOTE: create a new instance of transaction
  const transaction = new anchor.web3.Transaction();

  // NOTE: add the input instruction to the new transaction
  retryArgs.instructions.forEach((instruction) => transaction.add(instruction));
  transaction.recentBlockhash = (
    retryArgs.block ||
    (await retryArgs.connection.getLatestBlockhash(retryArgs.commitment))
  ).blockhash;

  transaction.feePayer = retryArgs.wallet.publicKey;

  if (retryArgs.includeFeePayer) {
    transaction.partialSign(...retryArgs.signers.map((signer) => signer));
  } else {
    transaction.partialSign(
      retryArgs.wallet,
      ...retryArgs.signers.map((signer) => signer)
    );
  }

  if (retryArgs.signers.length > 0) {
    transaction.sign(...[retryArgs.wallet, ...retryArgs.signers]);
  } else {
    transaction.sign(retryArgs.wallet);
  }

  if (retryArgs.beforeSend) {
    retryArgs.beforeSend();
  }

  const { txid, slot } = await sendSignedTransaction({
    connection: retryArgs.connection,
    signedTransaction: transaction,
  });

  return { txid, slot };
};

export const sendSignedTransaction = async (
  args: SignedTransactionArgs
): Promise<{ txid: string; slot: number }> => {
  const rawTransaction = args.signedTransaction.serialize();
  const startTime = getUnixTs();
  let slot = 0;

  // NOTE: send raw transaction
  const txid: anchor.web3.TransactionSignature =
    await args.connection.sendRawTransaction(rawTransaction, {
      skipPreflight: true,
    });

  console.debug(
    "[accounts] [sendSignedTransaction] Started awaiting confirmation for",
    txid
  );

  let done = false;
  (async () => {
    while (!done && getUnixTs() - startTime < args.timeout) {
      args.connection.sendRawTransaction(rawTransaction, {
        skipPreflight: true,
      });

      await sleep(500);
    }
  })();

  try {
    // NOTE: wait for confirmation before procede
    const confirmation = await awaitTransactionSignatureConfirmation(
      txid,
      args.timeout,
      args.connection,
      "confirmed",
      true
    );

    if (!confirmation) {
      throw new Error("Timed out awaiting confirmation on transaction");
    }

    if (confirmation.err) {
      console.error(confirmation.err);
      throw new Error("Transaction failed: Custom instruction error");
    }

    slot = confirmation?.slot || 0;
  } catch (error) {
    error["timeout"] = "";
    console.error("Timeout Error caught", error);
    if (error) {
      throw new Error("Timed out awaiting confirmation on transaction");
    }
  } finally {
    done = true;
  }

  console.debug("Latency (ms)", txid, getUnixTs() - startTime);
  return { txid, slot };
};

export const awaitTransactionSignatureConfirmation = async (
  txid: anchor.web3.TransactionSignature,
  timeout: number,
  connection: anchor.web3.Connection,
  commitment: anchor.web3.Commitment,
  queryStatus: boolean
): Promise<SignatureStatus | null | void> => {
  // NOTE: init status variables
  let done = false;
  let status: SignatureStatus = {
    confirmations: 0,
    err: null,
    slot: 0,
  };
  let subId = 0;

  try {
    await waitForConfirmation(
      done,
      timeout,
      txid,
      subId,
      connection,
      status,
      commitment,
      queryStatus
    );
  } catch (error) {
    console.error(" error => ", error);
  } finally {
    done = true;
    console.debug("Returning status", status);
    return status;
  }
};

export const waitForConfirmation = async (
  done: boolean,
  timeout: number,
  txid: anchor.web3.TransactionSignature,
  subId: number,
  connection: anchor.web3.Connection,
  status: SignatureStatus,
  commitment: anchor.web3.Commitment,
  queryStatus: boolean
) => {
  return new Promise(async (resolve, reject) => {
    await setTimeOutWithCondition(timeout, done, reject);

    try {
      subId = connection.onSignature(
        txid,
        (result, context) => {
          done = true;
          status.confirmations = 0;
          status.err = result.err;
          status.slot = context.slot;

          if (result.err) {
            console.warn("Rejected via websocket", result.err);
            reject(status);
          } else {
            console.debug("Resolved via websocket", result);

            console.log("Resolved status => ", status);
            resolve(status);
          }
        },
        commitment
      );
    } catch (error) {
      done = true;
      console.error("WS error in setup", txid, error);
    }

    while (!done && queryStatus) {
      await confirmSignatureStatuses(
        connection,
        txid,
        status,
        done,
        resolve,
        reject
      );
      await sleep(2000);
    }
  });
};

const setTimeOutWithCondition = (
  time: number,
  condition: boolean,
  reject: (reason?: any) => void
): void => {
  setTimeout(() => {
    if (condition) return;
    condition = true;
    console.warn(" REJECTING FOR TIMEOUT...");
    reject({
      timeout: true,
    });
  }, time);
};

const confirmSignatureStatuses = async (
  connection: anchor.web3.Connection,
  txid: anchor.web3.TransactionSignature,
  status: SignatureStatus,
  done: boolean,
  resolve: (value: unknown) => void,
  reject: (reason?: any) => void
) => {
  try {
    const signatureStatuses = await connection.getSignatureStatuses([txid]);
    status = signatureStatuses && signatureStatuses.value[0];

    if (!done) {
      if (!status) {
        console.debug("REST null result for", txid, status);
      } else if (status.err) {
        console.error("REST error for", txid, status);
        done = true;
        reject(status.err);
      } else if (!status.confirmations) {
        console.debug("REST no confirmations for", txid, status);
      } else {
        console.debug("REST confirmation for", txid, status);
        done = true;
        resolve(status);
      }
    }
  } catch (error) {
    if (!done) {
      console.error("REST connection error: txid", txid, error);
    }
  }
};

export const getAuctionHouseBuyerEscrow = async (
  auctionHouse: anchor.web3.PublicKey,
  wallet: anchor.web3.PublicKey
): Promise<[PublicKey, number]> => {
  const auctionHouseBuyerEscrowAddress: [PublicKey, number] =
    await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from(AUCTION_HOUSE), auctionHouse.toBuffer(), wallet.toBuffer()],
      AUCTION_HOUSE_PROGRAM_ID
    );

  return auctionHouseBuyerEscrowAddress;
};
