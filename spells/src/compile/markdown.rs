use super::tokenizer::Indent;
use markdown;

pub fn compile_markdown(md: &String, _indent: Indent) -> String {
  // markdown::to_html(md)
  markdown::to_html_with_options(md, &markdown::Options {
    compile: markdown::CompileOptions {
      allow_any_img_src: true,
      allow_dangerous_html: true,
      allow_dangerous_protocol: true,
      ..markdown::CompileOptions::default()
    },
    ..markdown::Options::default()
  }).unwrap()
}

pub fn compile_half_markdown(md: &String, _indent: Indent) -> String {
  let mut result = String::new();
  let mut chars = md.chars().peekable();

  // Track whether we're inside certain markdown states
  let mut bold = false;
  let mut italic = false;
  let mut code = false;
  let mut strike = false;

  while let Some(c) = chars.next() {
    match c {
      // Handle backtick code
      '`' => {
        if code {
          result.push_str("</code>");
        } else {
          result.push_str("<code>");
        }
        code = !code;
      }

      // Handle asterisks (*) for bold/italic
      '*' => {
        // Peek ahead to see if it's a double `**` (bold)
        if chars.peek() == Some(&'*') {
          chars.next(); // consume the second '*'
          if bold {
            result.push_str("</strong>");
          } else {
            result.push_str("<strong>");
          }
          bold = !bold;
        } else {
          if italic {
            result.push_str("</em>");
          } else {
            result.push_str("<em>");
          }
          italic = !italic;
        }
      }

      // Handle underscores (_) same as asterisks
      '_' => {
        if chars.peek() == Some(&'_') {
          chars.next(); // consume second '_'
          if bold {
            result.push_str("</strong>");
          } else {
            result.push_str("<strong>");
          }
          bold = !bold;
        } else {
          if italic {
            result.push_str("</em>");
          } else {
            result.push_str("<em>");
          }
          italic = !italic;
        }
      }

      // Handle strikethrough ~~text~~
      '~' => {
        if chars.peek() == Some(&'~') {
          chars.next(); // consume the second '~'
          if strike {
            result.push_str("</del>");
          } else {
            result.push_str("<del>");
          }
          strike = !strike;
        } else {
          result.push('~');
        }
      }

      // Default: just push character
      _ => result.push(c),
    }
  }

  result
}

