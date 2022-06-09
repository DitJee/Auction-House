import * as anchor from "@project-serum/anchor";
import { expect } from "chai";

import { AuctionHouse } from "../target/types/auction_house";
import { createAuctionHouse, showAuctionHouse } from "./utils";
import { addSOLToWallet } from "./utils/account";
import { loadWalletKey } from "./utils/constants";

describe("auction-house", () => {
  // Configure the client to use the local cluster.
  const env = "https://api.devnet.solana.com";

  it("Should successfully create auction house", async () => {
    // init

    const _keypair = anchor.web3.Keypair.generate();

    await addSOLToWallet(_keypair);
    const walletKeyPair = loadWalletKey(_keypair.secretKey);

    try {
      const auctionHouse: anchor.web3.PublicKey = await createAuctionHouse({
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
});
