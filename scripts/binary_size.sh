cd "$(dirname "$0")"
cd ../spells
cargo build --release
cd target/release
du -h spells
