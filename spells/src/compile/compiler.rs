use std::{fs, path::Path};

use super::{error::CompilerError, parser::Parser, tokenizer::Tokenizer};

pub fn build(file_path: &Path) -> Result<(), CompilerError> {
  let file_string = fs::read_to_string(file_path).unwrap();
  build_from_source(file_string)?;

  Ok(())
}

pub fn build_from_source(source: String) -> Result<(), CompilerError> {
  let mut tokenizer = Tokenizer::new(&source);
  let mut parser = Parser::new();
  let elements = parser.parse(&mut tokenizer)?;
  dbg!(elements);

  Ok(())
}

#[test]
fn test() {
  let s = "
some-tokens.and.some.others(@ do=\"this!\",and-others=dont).
  Nice!
    Another!
  Please!
div.123
some-tokens(@)
".to_owned();
  build_from_source(s);

  panic!();
}
