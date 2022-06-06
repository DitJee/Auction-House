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
}
