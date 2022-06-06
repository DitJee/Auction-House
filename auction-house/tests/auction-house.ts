import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";

import { AuctionHouse } from "../target/types/auction_house";

describe("auction-house", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.AuctionHouse as Program<AuctionHouse>;
  const programProvider = program.provider as anchor.AnchorProvider;

  // TODO: add create_auction_house test

  it("Should successfully create auction house", async () => {});
});
