import { web3 } from "@project-serum/anchor";
import {
  clusterApiUrl,
  Connection,
  Keypair,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { expect } from "chai";
import * as AuctionHouse from "../generated";
import {
  CreateAuctionHouseInstructionAccounts,
  CreateAuctionHouseInstructionArgs,
  PROGRAM_ID,
} from "../generated";

describe("auction-house", () => {
  // init pubkeys
  const wallet = web3.Keypair.generate();

  // for create auction accounts struct
  const authority = web3.Keypair.generate();
  const feeWithdrawalDestination = web3.Keypair.generate();
  const treasuryWithdrawalDestination = web3.Keypair.generate();
  const treasuryWithdrawalDestinationOwner = web3.Keypair.generate();
  const auctionHouse = web3.Keypair.generate();
  const auctionHouseFeeAccount = web3.Keypair.generate();
  const auctionHouseTreasury = web3.Keypair.generate();

  // FIXME: change to the real program ID

  const network = clusterApiUrl("devnet");

  const connection = new Connection(network);

  // add SOL to newly generated wallet
  const initWallet = async () => {
    try {
      const airdropSignature = await connection.requestAirdrop(
        wallet.publicKey,
        2 * web3.LAMPORTS_PER_SOL // 10000000 Lamports in 1 SOL
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

  const createTreasuryMint = async (): Promise<web3.Keypair> => {
    try {
      const treasuryMint = web3.Keypair.generate();

      // const airdropSignature = await connection.requestAirdrop(
      //   treasuryMint.publicKey,
      //   2 * web3.LAMPORTS_PER_SOL // 10000000 Lamports in 1 SOL
      // );

      // const latestBlockHash = await connection.getLatestBlockhash();

      // await connection.confirmTransaction({
      //   blockhash: latestBlockHash.blockhash,
      //   lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      //   signature: airdropSignature,
      // });

      // const walletbalance = await connection.getBalance(treasuryMint.publicKey);

      // console.log("treasuryMint balance =>", walletbalance);

      const instruction: TransactionInstruction =
        web3.SystemProgram.createAccount({
          fromPubkey: wallet.publicKey,
          newAccountPubkey: treasuryMint.publicKey,
          space: 16,
          lamports: 1000,
          programId: PROGRAM_ID,
        });

      const transaction: Transaction = new Transaction().add(instruction);

      await web3.sendAndConfirmTransaction(connection, transaction, [
        treasuryMint,
        wallet,
      ]);

      return treasuryMint;
    } catch (error) {
      console.log("error createTreasuryMint => ", __filename, error);
      expect("as").to.equal(error.message);
    }
  };

  // TODO: add create_auction_house test

  it("Should successfully create auction house", async () => {
    try {
      console.log(" creating auction house");

      await initWallet();

      // const auctionKey = (
      //   await findProgramAddress(
      //     [
      //       Buffer.from(AUCTION_PREFIX),
      //       toPublicKey(PROGRAM_IDS.auction).toBuffer(),
      //       toPublicKey(vault).toBuffer(),
      //     ],
      //     toPublicKey(PROGRAM_IDS.auction)
      //   )
      // )[0];

      const treasuryMint = await createTreasuryMint();

      const acocunts: CreateAuctionHouseInstructionAccounts = {
        treasuryMint: treasuryMint.publicKey,
        payer: wallet.publicKey,
        authority: authority.publicKey,
        feeWithdrawalDestination: feeWithdrawalDestination.publicKey,
        treasuryWithdrawalDestination: treasuryWithdrawalDestination.publicKey,
        treasuryWithdrawalDestinationOwner:
          treasuryWithdrawalDestinationOwner.publicKey,
        auctionHouse: auctionHouse.publicKey,
        auctionHouseFeeAccount: auctionHouseFeeAccount.publicKey,
        auctionHouseTreasury: auctionHouseTreasury.publicKey,
      };

      const args: CreateAuctionHouseInstructionArgs = {
        bump: 0,
        feePayerBump: 0,
        treasuryBump: 0,
        sellerFeeBasisPoints: 100,
        requiresSignOff: false,
        canChangeSalePrice: false,
      };
      const instruction: TransactionInstruction =
        AuctionHouse.createCreateAuctionHouseInstruction(acocunts, args);

      const transaction: Transaction = new web3.Transaction().add(instruction);

      const signature = await web3.sendAndConfirmTransaction(
        connection,
        transaction,
        [wallet]
      );

      console.log(" signature => ", signature);
    } catch (error) {
      console.log("error => ", __filename, error);
      expect("as").to.equal(error.message);
    }
  });
});
