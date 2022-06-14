use anchor_lang::prelude::*;

#[error_code]
pub enum AuctionHouseError {
    #[msg("The account is not mutable")]
    NotMutableAccount,

    #[msg("Bump seed not in hash map.")]
    BumpSeedNotInHashMap,

    #[msg("Public keys are not matched")]
    PublicKeyMismatch,

    #[msg("The given account is not an owner")]
    IncorrectOwner,

    #[msg("Cannot initialized the account")]
    UninitializedAccount,

    #[msg("Must use auctioneer handler.")]
    MustUseAuctioneerHandler,

    #[msg("This sale requires a signer")]
    SaleRequiresSigner,

    #[msg("Cannot take this action without auction house signing too")]
    CannotTakeThisActionWithoutAuctionHouseSignOff,

    #[msg("No payer present on this txn")]
    NoPayerPresent,

    #[msg("Derived key invalid")]
    DerivedKeyInvalid,

    #[msg("Metadata doesn't exist")]
    MetadataDoesntExist,

    #[msg("Invalid token amount")]
    InvalidTokenAmount,

    #[msg("Test error")]
    TestError,

    #[msg("NumericalOverflow")]
    NumericalOverflow,

    #[msg("Cannot match free sales unless the auction house or seller signs off")]
    CannotMatchFreeSalesWithoutAuctionHouseOrSellerSignoff,

    #[msg("Both parties need to agree to this sale")]
    BothPartiesNeedToAgreeToSale,

    #[msg("Seller ata cannot have a delegate set")]
    SellerATACannotHaveDelegate,

    #[msg("Buyer ata cannot have a delegate set")]
    BuyerATACannotHaveDelegate,

    #[msg("No valid signer present")]
    NoValidSignerPresent,
}
