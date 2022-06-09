import * as anchor from "@project-serum/anchor";
import { publicKey } from "@project-serum/anchor/dist/cjs/utils";
import { expect } from "chai";

import { AuctionHouse } from "../target/types/auction_house";
import { createAuctionHouse, sell, showAuctionHouse } from "./utils";
import { addSOLToWallet } from "./utils/account";
import {
  loadWalletKey,
  MINT_ADDRESS_AMONGUS,
  MINT_ADDRESS_FLOWER_FIELD,
} from "./utils/constants";
import { SellAuctionHouseArgs } from "./utils/interfaces";

import { base58_to_binary } from "base58-js";

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
      const jeeKeypair: anchor.web3.Keypair = new anchor.web3.Keypair({
        publicKey: new anchor.web3.PublicKey(
          "ESz5bto4fkF68grek4cAhsfn7r9XBnG85RLZLkJRAzbE"
        ).toBuffer(),
        secretKey: base58_to_binary(
          "4KVhGLcLJJqppjZb9MbDZSXCJp1Qh8Xr9sbVTeCboGrRRCaeJ2SvNkuGvs7kW5wPYJfSrjs75fcSLT3d86ncx9yN"
        ),
      });

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
      await sell(sellArgs);
    } catch (error) {
      console.log("error in sell test => ", error.message);
      console.error("error in sell test => ", error);
    }
  });
});
