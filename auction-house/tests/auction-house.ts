import * as anchor from "@project-serum/anchor";
import { publicKey } from "@project-serum/anchor/dist/cjs/utils";
import { expect } from "chai";

import { AuctionHouse } from "../target/types/auction_house";
import {
  buy,
  createAuctionHouse,
  executeSale,
  sell,
  showAuctionHouse,
} from "./utils";
import { addSOLToWallet } from "./utils/account";
import {
  loadWalletKey,
  MINT_ADDRESS_AMONGUS,
  MINT_ADDRESS_FLOWER_FIELD,
} from "./utils/constants";
import {
  BuyAuctionHouseArgs,
  ExecuteSaleAuctionHouseArgs,
  SellAuctionHouseArgs,
} from "./utils/interfaces";

import { base58_to_binary } from "base58-js";

let auctionHouse: anchor.web3.PublicKey;
let _keypair: anchor.web3.Keypair;
let walletKeyPair: anchor.web3.Keypair;
let tokenAccount: anchor.web3.PublicKey;

const initAuctionHouse = async (): Promise<void> => {
  _keypair = anchor.web3.Keypair.generate();

  await addSOLToWallet(_keypair);
  walletKeyPair = loadWalletKey(_keypair.secretKey);

  auctionHouse = await createAuctionHouse({
    keypair: walletKeyPair,
    env: "devnet",
    sellerFeeBasisPoints: 100,
    canChangeSalePrice: false,
    requiresSignOff: false,
    treasuryWithdrawalDestination: null,
    feeWithdrawalDestination: null,
    treasuryMint: null,
  });

  console.log("auctionHouse.toBase58 => ", auctionHouse.toBase58());
};

describe("auction-house", () => {
  // Configure the client to use the local cluster.
  const env = "https://api.devnet.solana.com";

  const jeeKeypair: anchor.web3.Keypair = new anchor.web3.Keypair({
    publicKey: new anchor.web3.PublicKey(
      "ESz5bto4fkF68grek4cAhsfn7r9XBnG85RLZLkJRAzbE"
    ).toBuffer(),
    secretKey: base58_to_binary(
      "4KVhGLcLJJqppjZb9MbDZSXCJp1Qh8Xr9sbVTeCboGrRRCaeJ2SvNkuGvs7kW5wPYJfSrjs75fcSLT3d86ncx9yN"
    ),
  });

  const buyerKeypair: anchor.web3.Keypair = new anchor.web3.Keypair({
    publicKey: new anchor.web3.PublicKey(
      "6TmKV9CajmPkjMM4AWooTgw9QELQqGaQZwg8zWjaRNTr"
    ).toBuffer(),
    secretKey: base58_to_binary(
      "55PtQoFR8QKxV1aFANHymTbLA9xWqgs7fQPxDvQSTE54WXS766vR1f1cmNKJzjLuhSTQtj5fEtSVQ49dh5opKWdW"
    ),
  });

  before((done) => {
    (async () => {
      try {
        await initAuctionHouse();
      } catch (error) {
        console.error("error while initializing => ", error);
      }

      done();
    })();
  });

  it("Should successfully create auction house", async () => {
    try {
      await showAuctionHouse({
        keypair: _keypair,
        env: "devnet",
        auctionHouse: auctionHouse.toBase58(),
        treasuryMint: null,
      });
    } catch (error) {
      expect(error.message).to.equal("error");
      console.error(error);
    }
  });

  it("should show auction sell information", async () => {
    // NOTE: init keys
    try {
      const sellArgs: SellAuctionHouseArgs = {
        keypair: jeeKeypair,
        env: env,
        auctionHouse: auctionHouse,
        auctionHouseKeypair: null,
        buyPrice: 1,
        mint: MINT_ADDRESS_FLOWER_FIELD,
        tokenSize: 1,
        auctionHouseSigns: false,
      };
      const { mintAddress, price, account, tokenAccountKey } = await sell(
        sellArgs
      );

      tokenAccount = tokenAccountKey;
    } catch (error) {
      console.log("error in sell test => ", error.message);
      console.error("error in sell test => ", error);
    }
  });

  it("should execute buy function", async () => {
    try {
      await addSOLToWallet(buyerKeypair);
      const buyArgs: BuyAuctionHouseArgs = {
        keypair: buyerKeypair,
        env: env,
        auctionHouse: auctionHouse,
        auctionHouseKeypair: null,
        buyPrice: 1,
        mint: MINT_ADDRESS_FLOWER_FIELD,
        tokenSize: 1,
        tokenAccount: tokenAccount,
      };

      await buy(buyArgs);
    } catch (error) {
      console.log("error in buy test => ", error.message);
      console.error("error in buy test => ", error);
    }
  });

  it("should execute execute_sale function", async () => {
    try {
      await addSOLToWallet(buyerKeypair);
      const executeSaleArgs: ExecuteSaleAuctionHouseArgs = {
        keypair: jeeKeypair,
        env: env,
        auctionHouse: auctionHouse,
        auctionHouseKeypair: null,
        buyPrice: 1,
        mint: MINT_ADDRESS_FLOWER_FIELD,
        tokenSize: 1,
        auctionHouseSigns: false,
        buyerWallet: buyerKeypair.publicKey,
        sellerWallet: jeeKeypair.publicKey,
      };

      await executeSale(executeSaleArgs);
    } catch (error) {
      console.log("error in execute_sale test => ", error.message);
      console.error("error in execute_sale test => ", error);
    }
  });
});
