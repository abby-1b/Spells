use crate::cli_error::CliError;

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
