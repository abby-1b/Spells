// use rstsc;

use spells::compile::{emitter::Emitter, options::CompileOptions, parser::Parser, tokenizer::Tokenizer};

fn main() {
  let source = "
div(#).
  ugh <sup>no</sup>
  ";

  let mut tokenizer = Tokenizer::new(&source);

  let mut parser = Parser::new();
  let elements = parser.parse(&mut tokenizer).unwrap();

  dbg!(&elements);

  let expected_capacity = source.len() * 5 / 4;

  let mut emitter = Emitter::new(&CompileOptions { pretty: true });
  let out = emitter.emit(expected_capacity, elements);

  dbg!(&out);
}
