use std::{fs, path::Path};
use crate::cli_error::CliError;
use super::{
  emitter::Emitter, error::CompilerError, options::CompileOptions, parser::Parser, tokenizer::Tokenizer
};

pub fn build_all(options: CompileOptions, directory: &Path) -> Result<(), CompilerError> {
  Ok(())
}

pub fn build_file(options: CompileOptions, file_path: &Path) -> Result<String, CompilerError> {
  let source = fs::read_to_string(file_path).unwrap();
  Ok(build_source_string(options, source)?)
}

pub fn build_source_string(options: CompileOptions, source: String) -> Result<String, CompilerError> {
  let mut tokenizer = Tokenizer::new(&source);

  let mut parser = Parser::new();
  let elements = parser.parse(&mut tokenizer)?;
  dbg!(&elements);

  let mut emitter = Emitter::new(options);
  let out = emitter.emit(elements);

  Ok(out)
}

#[test]
fn test() {
  let source = "
some-tokens.and.some.others(@ do=\"this!\",and-others=dont).
  Nice!
    Another!
  Please!
div.123(value=\"some\")
  h1(some-attribute=\"@{value} nice!\") Yay! Content!
some-tokens(@)
".to_owned();
  let out = build_source_string(
    CompileOptions {
      pretty: true,
    },
    source
  );
  match out {
    Err(err) => { dbg!(err.string()); } ,
    Ok(out) => { println!("{}", out); } ,
  }

  panic!();
}
