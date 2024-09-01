use crate::cli_error::CliError;

pub enum CompilerError {
  SpellsError { message: String }
}

impl CliError for CompilerError {
  fn string(&self) -> String {
    todo!()
  }
}

pub fn build() -> Result<(), CompilerError> {
  Ok(())
}
