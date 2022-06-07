import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { expect } from "chai";

import { AuctionHouse } from "../target/types/auction_house";
import { createAuctionHouse, loadAuctionHouseProgram } from "./utils";
import { loadWalletKey } from "./utils/constants";

describe("auction-house", () => {
  // Configure the client to use the local cluster.
  const env = "https://api.devnet.solana.com";

  it("Should successfully create auction house", async () => {
    // init
    const _keypair = anchor.web3.Keypair.generate();
    const walletKeyPair = loadWalletKey(_keypair.secretKey);

    try {
      await createAuctionHouse({
        keypair: walletKeyPair,
        env: "devnet",
        sellerFeeBasisPoints: 1000,
        canChangeSalePrice: false,
        requiresSignOff: false,
        treasuryWithdrawalDestination: null,
        feeWithdrawalDestination: null,
        treasuryMint: null,
      });
    } catch (error) {
      expect(error.message).to.equal("error");
      console.error(error);
    }
  });
});
