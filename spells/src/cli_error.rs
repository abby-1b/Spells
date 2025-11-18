use std::process::exit;

pub trait CliError {
  /// Returns the error as a string without exiting the process
  fn string(self) -> String;
}

pub fn throw_cli_error(err: impl CliError) {
  println!("{}", err.string());
  exit(1);
}

pub struct CliArgError {
  message: String
}
impl CliArgError {
  pub fn new(message: String) -> Self { Self { message } }
}
impl CliError for CliArgError {
  fn string(self) -> String {
    return self.message;
  }
}
