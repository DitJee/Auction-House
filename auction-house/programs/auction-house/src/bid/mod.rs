use anchor_lang::{
    prelude::*,
    solana_program::{program::invoke, system_instruction},
    AnchorDeserialize,
};
use anchor_spl::token::{Mint, Token, TokenAccount};
use solana_program::{program_memory::sol_memset, unchecked_div_by_const};

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
    #[account(seeds = [PREFIX.as_bytes(), auction_house.creator.as_ref(), auction_house.treasury_mint.as_ref()], bump = auction_house.bump, has_one = authority, has_one = treasury_mint, has_one = auction_house_fee_account)]
    auction_house: Box<Account<'info, AuctionHouse>>,

    /// CHECK: Not dangerous. Account seeds checked in constraint.
    /// Auction House instance fee account
    #[account(mut, seeds = [PREFIX.as_bytes(), auction_house.key().as_ref(), FEE_PAYER.as_bytes()], bump = auction_house.fee_payer_bump)]
    auction_house_fee_account: UncheckedAccount<'info>,

    /// CHECK: Not dangerous. Account seeds checked in constraint.
    /// Buyer trade state PDA.
    #[account(
        mut, 
        seeds = [
            PREFIX.as_bytes(),
            wallet.key().as_ref(),
            auction_house.key().as_ref(),
            token_account.key().as_ref(),
            treasury_mint.key().as_ref(),
            token_account.mint.as_ref(),
            buyer_price.to_le_bytes().as_ref(),
            token_size.to_le_bytes().as_ref()
        ],
        bump = trade_state_bump)
    ]
    buyer_trade_state: UncheckedAccount<'info>,

    token_program: Program<'info, Token>,
    system_program: Program<'info, System>,
    rent: Sysvar<'info, Rent>
}

pub fn private_bid<'info> (
    ctx: Context<'_, '_, '_, 'info, Buy<'info>>,
    trade_state_bump: u8,
    escrow_payment_bump: u8,
    buyer_price: u64,
    token_size: u64
) -> Result<()> {
    bid_logic(
        ctx.accounts.wallet.to_owned(),
        ctx.accounts.payment_account.to_owned(),
        ctx.accounts.transfer_authority.to_owned(),
        ctx.accounts.treasury_mint.to_owned(),
        *ctx.accounts.token_account.to_owned(),
        ctx.accounts.metadata.to_owned(),
        ctx.accounts.escrow_payment_account.to_owned(),
        ctx.accounts.authority.to_owned(),
        *ctx.accounts.auction_house.to_owned(),
        ctx.accounts.auction_house_fee_account.to_owned(),
        ctx.accounts.buyer_trade_state.to_owned(),
        ctx.accounts.token_program.to_owned(),
        ctx.accounts.system_program.to_owned(),
        ctx.accounts.rent.to_owned(),
        trade_state_bump,
        escrow_payment_bump,
        buyer_price,
        token_size,
        false,
    )
    
}

pub fn bid_logic<'info>( // Basically every thing in `Buy` struct and arguments
    wallet: Signer<'info>,
    payment_account: UncheckedAccount<'info>,
    transfer_authority: UncheckedAccount<'info>,
    treasury_mint: Account<'info, Mint>,
    token_account: Account<'info, TokenAccount>,
    metadata: UncheckedAccount<'info>,
    escrow_payment_account: UncheckedAccount<'info>,
    authority: UncheckedAccount<'info>,
    auction_house: Account<'info,AuctionHouse>,
    auction_house_fee_account: UncheckedAccount<'info>,
    buyer_trade_state: UncheckedAccount<'info>,
    token_program: Program<'info, Token>,
    system_program: Program<'info, System>,
    rent: Sysvar<'info, Rent> ,
    trade_state_bump: u8,
    escrow_payment_bump: u8,
    buyer_price: u64,
    token_size: u64,
    public: bool

) -> Result<()> {
     // If it has an auctioneer authority delegated must use auctioneer_* handler.
     if auction_house.has_auctioneer {
        return Err(AuctionHouseError::MustUseAuctioneerHandler.into());
    }

    assert_valid_trade_state(
        &wallet.key(),
        &auction_house,
        buyer_price,
        token_size,
        &buyer_trade_state,
        &token_account.mint.key(),
        &token_account.key(),
        trade_state_bump
    )?;

    let auction_house_key = auction_house.key();
    let seeds = [
        PREFIX.as_bytes(),
        auction_house_key.as_ref(),
        FEE_PAYER.as_bytes(),
        &[auction_house.fee_payer_bump]
    ];

    let (fee_payer, fee_seeds) = get_fee_payer(
        &authority, 
        &auction_house, 
        wallet.to_account_info(), 
        auction_house_fee_account.to_account_info(),
        &seeds
    )?;

    let is_native = treasury_mint.key() == spl_token::native_mint::id();

    let wallet_key = wallet.key();
    let escrow_signer_seeds = [
        PREFIX.as_bytes(),
        auction_house_key.as_ref(),
        wallet_key.as_ref(),
        &[escrow_payment_bump]
    ];

    create_program_token_account_if_not_present(
        &escrow_payment_account,
        &system_program,
        &fee_payer,
        &token_program,
        &treasury_mint,
        &auction_house.to_account_info(),
        &rent,
        &escrow_signer_seeds,
        fee_seeds,
        is_native,
    )?;

    if is_native {
        assert_keys_equal(wallet.key(), payment_account.key())?;
        
        // NOTE: check whether the lamport in escrow account is enough for buyer_price + rent
        if escrow_payment_account.lamports() < buyer_price.checked_add(rent.minimum_balance(escrow_payment_account.data_len())).ok_or(AuctionHouseError::NumericalOverflow)?{
            let diff = buyer_price
                .checked_add(rent.minimum_balance(escrow_payment_account.data_len()))
                .ok_or(AuctionHouseError::NumericalOverflow)?
                .checked_sub(escrow_payment_account.lamports())
                .ok_or(AuctionHouseError::NumericalOverflow)?;

                // NOTE: if the lamport inside escrow account is not enough, transfer more lamport to it
                invoke(
                    &system_instruction::transfer(&payment_account.key(), &escrow_payment_account.key(), diff),
                    &[
                        payment_account.to_account_info(),
                        escrow_payment_account.to_account_info(),
                        system_program.to_account_info()
                    ]
                )?;
        }
    } else {
        let escrow_payment_loaded : spl_token::state::Account = assert_initialized(&escrow_payment_account)?;

        // NOTE: if the lamport inside escrow account is not enough, transfer more lamport to it
        if escrow_payment_loaded.amount < buyer_price {
            let diff = buyer_price.checked_sub(escrow_payment_loaded.amount).ok_or(AuctionHouseError::NumericalOverflow)?;

            invoke(
                &spl_token::instruction::transfer(
                    &token_program.key(),
                     &payment_account.key(), 
                     &escrow_payment_account.key(),
                      &transfer_authority.key(),
                       &[],
                        diff)?,
                         &[
                             transfer_authority.to_account_info(),
                              payment_account.to_account_info(),
                               escrow_payment_account.to_account_info(),
                                token_program.to_account_info()
                                ]
                            )?;
        }
    }

    assert_metadata_valid(&metadata, &token_account)?;

    let ts_info = buyer_trade_state.to_account_info();
    if ts_info.data_is_empty() {
        let wallet_key = wallet.key();
        let token_account_key = token_account.key();

        if public {
            create_or_allocate_account_raw(crate::id(), &ts_info, &rent.to_account_info(), &system_program, &fee_payer,TRADE_STATE_SIZE, fee_seeds, &[
                PREFIX.as_bytes(),
                wallet_key.as_ref(),
                auction_house_key.as_ref(),
                auction_house.treasury_mint.as_ref(),
                token_account.mint.as_ref(),
                &buyer_price.to_le_bytes(),
                &token_size.to_le_bytes(),
                &[trade_state_bump]
            ])?;
        } else {
            create_or_allocate_account_raw(
                crate::id(), 
                &ts_info, 
                &rent.to_account_info(), &system_program, 
                &fee_payer,
                TRADE_STATE_SIZE, 
                fee_seeds, 
                &[
                    PREFIX.as_bytes(),
                    wallet_key.as_ref(),
                    auction_house_key.as_ref(),
                    token_account_key.as_ref(),
                    auction_house.treasury_mint.as_ref(),
                    token_account.mint.as_ref(),
                    &buyer_price.to_le_bytes(),
                    &token_size.to_le_bytes(),
                    &[trade_state_bump]
                ]
            )?;
        }

        sol_memset(*ts_info.try_borrow_mut_data()?, trade_state_bump, TRADE_STATE_SIZE);
    }

    Ok(())
}

