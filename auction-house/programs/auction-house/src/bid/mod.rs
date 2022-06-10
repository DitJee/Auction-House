use anchor_lang::{
    prelude::*,
    solana_program::{program::invoke, system_instruction},
    AnchorDeserialize,
};
use anchor_spl::token::{Mint, Token, TokenAccount};
use solana_program::program_memory::sol_memset;

use crate::{
    constant::*, errors::AuctionHouseError, utils::*, AuctionHouse, AuthorityScope,
    TRADE_STATE_SIZE,
};

#[derive(Accounts)]
#[instruction(trade_state_bump: u8,
escrow_payment_bump: u8,
buyer_price: u64,
token_size: u64)]
pub struct Buy<'info> {
    /// User wallet account
    wallet: Signer<'info>,

    /// CHECK: Validated in big_logic
    /// User SOL or SPL account to transfer funds from.
    #[account(mut)]
    payment_account: UncheckedAccount<'info>,

    /// CHECK: Validated in bid_logic.
    /// SPL token account transfer authority.
    transfer_authority: UncheckedAccount<'info>,

    /// Auction House instance treasurt mint account
    treasury_mint: Account<'info, Mint>,

    /// SPL token account.
    token_account: Box<Account<'info, TokenAccount>>,

    /// CHECK: Validated in bid_logic
    /// SPL token account metadata.
    metadata: UncheckedAccount<'info>,

    /// CHECK: Validated in bid_logic
    /// Auction House instance authority account.
    authority: UncheckedAccount<'info>,

    /// CHECK: Not dangerous. Account seeds checked in constraint.
    /// Buyer escrow payment account PDA.
    #[account(mut, seeds = [PREFIX.as_bytes(), auction_house.key().as_ref(), wallet.key().as_ref()], bump = escrow_payment_bump)]
    escrow_payment_account: UncheckedAccount<'info>,

    // Auction House instance PDA account
    #[account(seeds = [PRE])]
}
