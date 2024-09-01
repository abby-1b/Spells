use std::process::exit;


pub trait CliError {
  /// Returns the error as a string without exiting the process
  fn string(&self) -> String;
}

pub fn throw_cli_error(err: impl CliError) {
  println!("{}", err.string());
  exit(1);
}
