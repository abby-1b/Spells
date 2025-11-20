use crate::cli_error::CliError;
use std::fmt;

#[derive(Debug)]
pub enum CompilerError {
  Indentation(String),
  Parse(String),
  IO(String),
}

impl CliError for CompilerError {
  fn string(self) -> String {
    match self {
      CompilerError::Indentation(s) => "Indentation Error: ".to_owned() + &s,
      CompilerError::Parse(s) => "Parse Error: ".to_owned() + &s,
      CompilerError::IO(s) => "IO Error: ".to_owned() + &s,
    }
  }
}

impl fmt::Display for CompilerError {
  fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
      match self {
          CompilerError::Indentation(s) => write!(f, "Indentation Error: {}", s),
          CompilerError::Parse(s) => write!(f, "Parse Error: {}", s),
          CompilerError::IO(s) => write!(f, "IO Error: {}", s),
      }
  }
}
