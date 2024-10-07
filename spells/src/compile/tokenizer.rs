use std::{iter::Peekable, str::Chars};

pub type Indent = u16;

pub struct Tokenizer<'a> {
  file_string: &'a str,
  char_iter: Peekable<Chars<'a>>,
  char_idx: usize,

  held_token: Option<&'a str>,
  held_indent: Option<(Indent, usize)>,
}

impl<'a> Tokenizer<'a> {
  pub fn new(
    file_string: &str,
  ) -> Tokenizer {

    let char_iter = file_string
      .chars()
      .peekable();

    Tokenizer {
      file_string,
      char_iter,
      char_idx: 0,
      held_token: None,
      held_indent: None
    }
  }

  /// Gets the indentation of the next line,
  /// consuming up to the first non-whitespace token.
  /// Also returns the number of empty lines since the last line.
  pub fn consume_indent(&mut self) -> (Indent, usize) {
    // Use cached indent
    if let Some(indent) = self.held_indent {
      self.held_indent = None;
      return indent;
    }

    let mut empty_lines: usize = 0;
    loop {
      // Get the indentation level
      let mut indent: Indent = 0;
      loop {
        match self.char_peek() {
          Some(' ' | '\t') => {
            // Whitespace
            self.char_consume();
            indent += 1;
          }
          Some('\n' | '\r') => {
            // Found newline, so this is an empty line
            self.char_consume();
            indent = Indent::MAX;
            empty_lines += 1;
            break;
          }
          None => { indent = 0; break; } // EOF
          _ => { break; } // Any other character (start of line after indentation)
        }
      }

      if indent != Indent::MAX {
        break (indent, empty_lines);
      }
    }
  }

  /// Peeks at the indentation of the next line,
  /// consuming up to the first non-whitespace token.
  /// Also returns the number of empty lines since the last line.
  pub fn peek_indent(&mut self) -> (Indent, usize) {
    if let Some(indent) = self.held_indent {
      indent
    } else {
      let indent = self.consume_indent();
      self.held_indent = Some(indent);
      indent
    }
  }

  /// Consumes a single non-whitespace token, returning it
  pub fn consume(&mut self) -> Option<&'a str> {
    if self.held_indent.is_some() { self.held_indent = None; }
    if let Some(token) = self.held_token {
      self.held_token = None;
      return Some(token);
    }

    self.get_token()
  }

  pub fn consume_ignore_newline(&mut self) -> Option<&'a str> {
    if self.held_indent.is_some() { self.held_indent = None; }
    if let Some(token) = self.held_token {
      self.held_token = None;
      return Some(token);
    }

    self.get_token_ignore_newline()
  }

  /// Consumes a whole line, not including the newline
  pub fn consume_line(&mut self) -> Option<&'a str> {
    if self.held_indent.is_some() { self.held_indent = None; }

    // Get the line start
    let start_idx = if let Some(held_token) = self.held_token {
      self.held_token = None;
      held_token.as_ptr() as usize - self.file_string.as_ptr() as usize
    } else {
      self.char_idx
    };

    // Get the line end
    while self.char_peek().is_some_and(|c| c != '\n') {
      self.char_consume();
    }
    let end_idx = self.char_idx;

    // Return that as a slice
    Some(&self.file_string[start_idx..end_idx])
  }

  /// Peeks at a single non-whitespace token
  pub fn peek(&mut self) -> Option<&'a str> {
    if self.held_indent.is_some() { self.held_indent = None; }
    if self.held_token.is_none() {
      self.held_token = self.get_token();
    }
    self.held_token
  }
  
  /// Peeks at a single non-whitespace token
  pub fn peek_ignore_newline(&mut self) -> Option<&'a str> {
    if self.held_indent.is_some() { self.held_indent = None; }
    if self.held_token.is_none() {
      self.held_token = self.get_token_ignore_newline();
    }
    self.held_token
  }

  /// Gets a single token, ignoring newlines
  fn get_token_ignore_newline(&mut self) -> Option<&'a str> {
    loop {
      
      // Try getting one token
      let potential = self.get_token();
      if potential.is_some() { return potential; }

      // If it's not a newline (meaning EOF)
      if !matches!(self.char_peek(), Some('\n' | '\r')) {
        break;
      }

      // Otherwise, it's a newline and should be ignored
      self.char_consume();
    }

    None
  }

  /// Gets a single non-whitespace token.
  /// None is returned if the token is a newline or the file ended.
  fn get_token(&mut self) -> Option<&'a str> {
    let c = *self.char_iter.peek()?;
    if c == '\n' || c == '\r' {
      while matches!(self.char_consume_and_peek(), Some('\n' | '\r')) {}
      return None;
    }

    let start_idx = self.char_idx;
    match c {
      'a'..='z' | 'A'..='Z' | '_' | '$' => {
        // Identifier
        while matches!(
          self.char_consume_and_peek(),
          Some('a'..='z' | 'A'..='Z' | '-' | '_' | '$' | '0'..='9')
        ) {}
      }
      '"' | '\'' => {
        // String
        loop {
          match self.char_consume_and_peek() {
            Some('\\') => { self.char_consume(); },
            Some(curr) if curr == c => { self.char_consume(); break; },
            _ => {}
          }
        }
      }
      '0'..='9' => {
        // Number
        while matches!(
          self.char_consume_and_peek(),
          Some('0'..='9' | '.')
        ) {}
      }
      _ => {
        // Single symbol
        self.char_consume();
      }
    }

    let end_idx = self.char_idx;

    // Ignore trailing whitespace (until it finds a newline)
    while matches!(self.char_peek(), Some(' ' | '\t')) {
      self.char_consume();
    }

    Some(&self.file_string[start_idx..end_idx])
  }

  #[inline]
  fn char_consume(&mut self) -> char {
    let c = self.char_iter.next().unwrap_or('\0');
    self.char_idx += c.len_utf8();
    c
  }

  #[inline]
  fn char_peek(&mut self) -> Option<char> {
    self.char_iter.peek().copied()
  }

  #[inline]
  fn char_consume_and_peek(&mut self) -> Option<char> {
    self.char_consume();
    self.char_peek()
  }
}
