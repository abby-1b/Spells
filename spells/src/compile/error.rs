use crate::cli_error::CliError;

pub enum CompilerError {
  IndentationError(String),
  ParseError(String)
}

impl CliError for CompilerError {
  fn string(&self) -> String {
    todo!()
  }
}
