use std::{
  fs,
  path::{Path, PathBuf},
  io,
};

use crate::cli_error::CliError;

use super::{
  emitter::Emitter, error::CompilerError, options::CompileOptions, parser::Parser, tokenizer::Tokenizer
};

/// Recursively builds all files in the input directory and copies them to the output directory.
pub fn build_all(options: &CompileOptions, input_dir: &Path, output_dir: &Path) -> Result<(), CompilerError> {
  
  // Empty the output directory
  // Ignore the error in case the directory doesn't exist.
  let _ = fs::remove_dir_all(output_dir);

  // Create the output directory
  fs::create_dir_all(output_dir)
    .map_err(|e| CompilerError::IO(format!("Failed to create output directory \"{}\": {}", output_dir.display(), e)))?;

  // Start the recursive process
  process_directory(&options, input_dir, output_dir, input_dir)?;
  
  Ok(())
}

/// A recursive helper function to traverse the input directory and process files.
fn process_directory(
  options: &CompileOptions, 
  from_dir: &Path, 
  to_dir: &Path, 
  root_dir_prefix: &Path
) -> Result<(), CompilerError> {
  let entries = fs::read_dir(from_dir)
    .map_err(|e| CompilerError::IO(format!("Failed to read directory \"{}\": {}", from_dir.display(), e)))?;

  for entry in entries {
    let entry = entry
      .map_err(|e| CompilerError::IO(format!("Failed to read directory entry in \"{}\": {}", from_dir.display(), e)))?;
    
    let from_path = entry.path();
    
    // Calculate the relative path from the root, mirroring the JS logic to remove the buildDir prefix
    let relative_path = from_path.strip_prefix(root_dir_prefix)
      .map_err(|e| CompilerError::IO(format!("Path strip error for \"{}\": {}", from_path.display(), e)))?;
    
    let to_path = to_dir.join(relative_path);
    
    let file_type = entry.file_type()
      .map_err(|e| CompilerError::IO(format!("Failed to get file type for \"{}\": {}", from_path.display(), e)))?;

    if file_type.is_dir() {
      // Make a directory
      fs::create_dir(&to_path)
        .map_err(|e| CompilerError::IO(format!("Failed to create directory \"{}\": {}", to_path.display(), e)))?;

      // Recurse into the new directory
      process_directory(options, &from_path, to_dir, root_dir_prefix)?;

    } else if file_type.is_file() {
      if from_path.extension().map_or(false, |ext| ext == "spl") {
        // Compile .spl files
        let html_path = to_path.with_extension("html");
        
        let source = fs::read_to_string(&from_path)
          .map_err(|e| CompilerError::IO(format!("Failed to read .spl file \"{}\": {}", from_path.display(), e)))?;
        
        // Use the provided compilation function
        let compiled_content = build_source_string(&options, source)?;

        fs::write(&html_path, compiled_content)
          .map_err(|e| CompilerError::IO(format!("Failed to write .html file \"{}\": {}", html_path.display(), e)))?;

      } else if from_path.extension().map_or(false, |ext| ext == "ts") {
        // Compile .ts files
        todo!("TypeScript file compilation: {}", from_path.display());
      } else {
        // Else, just copy the file
        fs::copy(&from_path, &to_path)
          .map_err(|e| CompilerError::IO(format!("Failed to copy file from \"{}\" to \"{}\": {}", from_path.display(), to_path.display(), e)))?;
      }
    }
  }
  Ok(())
}


pub fn build_file(options: &CompileOptions, file_path: &Path) -> Result<String, CompilerError> {
  let source = fs::read_to_string(file_path).unwrap();
  Ok(build_source_string(options, source)?)
}

pub fn build_source_string(options: &CompileOptions, source: String) -> Result<String, CompilerError> {
  let mut tokenizer = Tokenizer::new(&source);

  let mut parser = Parser::new();
  let elements = parser.parse(&mut tokenizer)?;

  let expected_capacity = source.len() * 5 / 4;

  let mut emitter = Emitter::new(options);
  let out = emitter.emit(expected_capacity, elements);

  Ok(out)
}

#[test]
fn test() {
  let source = "
// test
some-tokens.and.some.others(@ do=\"this!\",and-others=dont).
  Nice!
    Another!
  Please!
div.123(value=\"some\")
  h1(some-attribute=\"@{value} nice!\") Yay! Content!
some-tokens(@)
".to_owned();
  let out = build_source_string(
    &CompileOptions {
      pretty: true,
    },
    source
  );
  match out {
    Err(err) => { dbg!(err.string()); },
    Ok(out) => { println!("{}", out); },
  }

  panic!();
}

