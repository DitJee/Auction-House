#![allow(warnings)]
pub mod bid;
pub mod constant;
pub mod errors;
pub mod sell;
pub mod state;
mod utils;

use crate::bid::*;
use crate::constant::*;
use crate::error::*;
use crate::sell::*;
use crate::state::*;
use crate::utils::*;

use anchor_lang::{
    prelude::*,
    solana_program::{program::invoke_signed, system_instruction},
    AnchorDeserialize, AnchorSerialize,
};

use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

declare_id!("Er4qqGJpN9CkQWeUp1P87aWYzkCqd4NbbKi8vtoNfPUJ"); // NOTE: ProgramID for Dev

#[program]
pub mod auction_house {
    use super::*;
    use crate::errors::AuctionHouseError;

    pub fn create_auction_house<'info>(
        ctx: Context<'_, '_, '_, 'info, CreateAuctionHouse<'info>>,
        _bump: u8,
        fee_payer_bump: u8,
        treasury_bump: u8,
        seller_fee_basis_points: u16,
        requires_sign_off: bool,
        can_change_sale_price: bool,
    ) -> Result<()> {
        // NOTE: validate the input seller fee basis point
        if seller_fee_basis_points > 10000 {
            return Err(AuctionHouseError::BumpSeedNotInHashMap.into());
        }
        // NOTE: Got variable from ctx
        let treasury_mint = &ctx.accounts.treasury_mint;
        let payer = &ctx.accounts.payer;
        let authority = &ctx.accounts.authority;
        let auction_house = &mut ctx.accounts.auction_house;
        let auction_house_fee_account = &ctx.accounts.auction_house_fee_account;
        let auction_house_treasury = &ctx.accounts.auction_house_treasury;
        let fee_withdrawal_destination = &ctx.accounts.fee_withdrawal_destination;
        let treasury_withdrawal_destination_owner =
            &ctx.accounts.treasury_withdrawal_destination_owner;
        let treasury_withdrawal_destination = &ctx.accounts.treasury_withdrawal_destination;
        let token_program = &ctx.accounts.token_program;
        let system_program = &ctx.accounts.system_program;
        let ata_program = &ctx.accounts.ata_program;
        let rent = &ctx.accounts.rent;

        // NOTE: populate auction house struct fields
        auction_house.bump = *ctx
            .bumps
            .get(PREFIX)
            .ok_or(errors::AuctionHouseError::BumpSeedNotInHashMap)?;

        auction_house.fee_payer_bump = fee_payer_bump;
        auction_house.treasury_bump = treasury_bump;
        auction_house.seller_fee_basis_points = seller_fee_basis_points;
        auction_house.requires_sign_off = requires_sign_off;
        auction_house.can_change_sale_price = can_change_sale_price;
        auction_house.creator = authority.key();
        auction_house.authority = authority.key();
        auction_house.treasury_mint = treasury_mint.key();
        auction_house.auction_house_fee_account = auction_house_fee_account.key();
        auction_house.auction_house_treasury = auction_house_treasury.key();
        auction_house.treasury_withdrawal_destination = treasury_withdrawal_destination.key();
        auction_house.fee_withdrawal_destination = fee_withdrawal_destination.key();

        let is_native = treasury_mint.key() == spl_token::native_mint::id();

        let auction_house_key = auction_house.key();

        let auction_house_treasury_seeds = [
            PREFIX.as_bytes(),
            auction_house_key.as_ref(),
            TREASURY.as_bytes(),
            &[treasury_bump],
        ];

        create_program_token_account_if_not_present(
            auction_house_treasury,
            system_program,
            payer,
            token_program,
            treasury_mint,
            &auction_house.to_account_info(),
            rent,
            &auction_house_treasury_seeds,
            &[],
            is_native,
        )?;

        if is_native {
            assert_keys_equal(
                treasury_withdrawal_destination.key(),
                treasury_withdrawal_destination_owner.key(),
            )?;
        } else {
            if treasury_withdrawal_destination.data_is_empty() {
                make_ata(
                    treasury_withdrawal_destination.to_account_info(),
                    treasury_withdrawal_destination_owner.to_account_info(),
                    treasury_mint.to_account_info(),
                    payer.to_account_info(),
                    ata_program.to_account_info(),
                    token_program.to_account_info(),
                    system_program.to_account_info(),
                    rent.to_account_info(),
                    &[],
                )?;
            }

            assert_is_ata(
                &treasury_withdrawal_destination.to_account_info(),
                &treasury_withdrawal_destination_owner.key(),
                &treasury_mint.key(),
            )?;
        }

        Ok(())
    }

    pub fn sell<'info>(
        ctx: Context<'_, '_, '_, 'info, Sell<'info>>,
        trade_state_bump: u8,
        free_trade_state_bump: u8,
        program_as_signer_bump: u8,
        buyer_price: u64,
        token_size: u64,
    ) -> Result<()> {
        sell::sell(
            ctx,
            trade_state_bump,
            free_trade_state_bump,
            program_as_signer_bump,
            buyer_price,
            token_size,
        )
    }

    pub fn buy<'info>(
        ctx: Context<'_, '_, '_, 'info, Buy<'info>>,
        trade_state_bump: u8,
        escrow_payment_bump: u8,
        buyer_price: u64,
        token_size: u64,
    ) -> Result<()> {
        private_bid(
            ctx,
            trade_state_bump,
            escrow_payment_bump,
            buyer_price,
            token_size,
        )
    }
}

#[derive(Accounts)]
#[instruction(bump:u8, fee_payer_bump: u8, treasury_bump: u8)]
pub struct CreateAuctionHouse<'info> {
    /// treasury account
    pub treasury_mint: Account<'info, Mint>,

    /// Key paying SOL fees for setting up the Auction House
    #[account(mut @ errors::AuctionHouseError::NotMutableAccount) ]
    pub payer: Signer<'info>,

    /// CHECK: User can use whatever they want for intialization.
    /// Authority key for the Auction House
    pub authority: UncheckedAccount<'info>,

    /// CHECK: User can use whatever they want for intialization.
    /// Account that pays for fees if the marketplace executes sales.
    #[account(mut)]
    pub fee_withdrawal_destination: UncheckedAccount<'info>,

    /// CHECK: User can use whatever they want for intialization.
    /// SOL or SPL token account to receive Auction House fees. If treasury mint is native this will be the same as the `treasury_withdrawl_destination_owner`.
    #[account(mut)]
    pub treasury_withdrawal_destination: UncheckedAccount<'info>,

    /// CHECK: User can use whatever they want for intialization.
    /// Owner of the `treasury_withdrawal_destination` account or the same address if the `treasury_mint` is native.
    pub treasury_withdrawal_destination_owner: UncheckedAccount<'info>,

    /// Auction House instance PDA account
    /// The PDA is seeded from Auction house PREFIX + authority key + treasury mint
    #[account(init, seeds=[PREFIX.as_bytes(), authority.key().as_ref(), treasury_mint.key().as_ref()], bump, space = AUCTION_HOUSE_SIZE, payer=payer)]
    pub auction_house: Account<'info, state::AuctionHouse>,

    /// Auction House instance fee account.
    /// CHECK: Not dangerous. Account seeds checked in constraint.
    #[account(mut, seeds=[PREFIX.as_bytes(), auction_house.key().as_ref(), FEE_PAYER.as_bytes()], bump=fee_payer_bump)]
    pub auction_house_fee_account: UncheckedAccount<'info>,

    /// Auction House instance treasury PDA account.
    /// CHECK: Not dangerous. Account seeds checked in constraint.
    #[account(mut, seeds=[PREFIX.as_bytes(), auction_house.key().as_ref(), TREASURY.as_bytes()], bump=treasury_bump)]
    pub auction_house_treasury: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub ata_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}
