import * as anchor from "@project-serum/anchor";
import { expect } from "chai";

import { AuctionHouse } from "../target/types/auction_house";
import { createAuctionHouse, sell, showAuctionHouse } from "./utils";
import { addSOLToWallet } from "./utils/account";
import { loadWalletKey, MINT_ADDRESS_AMONGUS } from "./utils/constants";
import { SellAuctionHouseArgs } from "./utils/interfaces";

let auctionHouse: anchor.web3.PublicKey;
let _keypair: anchor.web3.Keypair;
let walletKeyPair: anchor.web3.Keypair;

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
        keypair: _keypair,
        env: env,
        auctionHouse: auctionHouse,
        auctionHouseKeypair: null,
        buyPrice: 1,
        mint: MINT_ADDRESS_AMONGUS,
        tokenSize: 1,
        auctionHouseSigns: false,
      };
      await sell(sellArgs);
    } catch (error) {
      console.log("error in sell test => ", error.message);
      console.error("error in sell test => ", error);
    }
  });
});
