#![cfg(feature = "test-bpf")]
pub mod utils;
use utils::setup_functions;
#[tokio::test]
async fn init_native_success() {
    let mut context = setup_functions::auction_house_program_test()
        .start_with_context()
        .await;
}
