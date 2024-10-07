use std::iter;

use super::{options::CompileOptions, parser::{Element, ElementContent}, tokenizer::Indent};

static INDENT_AMOUNT: Indent = 2;
static UNCLOSED_TAGS: &[&str] = &[
  "br",
  "img",
  "meta",
  "wbr",
];
static NO_MARKDOWN: &[&str] = &[
  "style",
  "css",
  "script",
];

pub struct Emitter {
  options: CompileOptions,
}

impl Emitter {
  pub fn new(options: CompileOptions) -> Emitter {
    Emitter {
      options
    }
  }

  pub fn emit(&mut self, elements: Vec<Element>) -> String {
    let mut out_string = "<!DOCTYPE html>\n".to_owned();
    let mut element_stack = vec![];
    self.emit_inner(&mut out_string, &mut element_stack, &elements, 0);
    out_string
  }

  fn emit_inner<'a>(
    &mut self,
    out_string: &mut String,
    element_stack: &mut Vec<&'a Element>,
    elements: &'a Vec<Element>,
    indent: Indent
  ) {
    for element in elements {
      element_stack.push(&element);
      self.emit_single_element(
        out_string,
        element_stack,
        self.options.pretty,
        indent
      );
      element_stack.pop();
    }
  }

  fn emit_single_element(
    &mut self,
    out_string: &mut String,
    element_stack: &mut Vec<&Element>,
    pretty: bool,
    indent: Indent
  ) {
    if pretty { self.indent(out_string, indent); }
    let tag_name = element_stack.last().unwrap().tag_name.as_str();

    // Open tag
    *out_string += "<";
    *out_string += tag_name;
    if let Some(id) = &element_stack.last().unwrap().id {
      *out_string += " id=\"";
      *out_string += &id;
      *out_string += "\"";
    }
    for attribute in &element_stack.last().unwrap().attributes {
      *out_string += " ";
      *out_string += &attribute.0;
      if let Some(equals) = &attribute.1 {
        *out_string += "=";
        self.emit_with_vars(
          element_stack,
          out_string,
          &equals
        );
      }
    }
    if !element_stack.last().unwrap().classes.is_empty() {
      *out_string += " class=\"";
      for class in &element_stack.last().unwrap().classes {
        *out_string += &class;
        *out_string += " ";
      }
      out_string.pop();
      *out_string += "\"";
    }
    *out_string += ">";

    match &element_stack.last().unwrap().content {
      ElementContent::Empty => {},
      ElementContent::InnerText(inner_text) => {
        if pretty { *out_string += "\n"; }
        if NO_MARKDOWN.contains(&tag_name) {
          self.emit_plaintext(out_string, inner_text, indent);
        } else {
          self.emit_markdown(
            out_string,
            inner_text,
            indent,
            element_stack
          );
        }
      }
      ElementContent::Children(children) => {
        if pretty { *out_string += "\n"; }
        self.emit_inner(
          out_string,
          element_stack,
          children,
          indent + INDENT_AMOUNT
        );
      }
    }

    // Close tag
    if !UNCLOSED_TAGS.contains(&tag_name) {
      if pretty { self.indent(out_string, indent); }
      *out_string += "</";
      *out_string += &element_stack.last().unwrap().tag_name;
      *out_string += ">";
    }

    if pretty { *out_string += "\n"; }
  }

  fn emit_markdown(
    &self,
    out_string: &mut String,
    md: &String,
    indent: Indent,
    element_stack: &mut Vec<&Element>,
  ) {
    *out_string += &md;
    *out_string += "\n";
  }

  fn emit_plaintext(
    &self,
    out_string: &mut String,
    plaintext: &String,
    indent: Indent,
  ) {
    *out_string += &plaintext;
    *out_string += "\n";
  }

  fn emit_with_vars(
    &self,
    element_stack: &mut Vec<&Element>,
    out_string: &mut String,
    emit_string: &String
  ) {
    let mut var_name = String::with_capacity(emit_string.len());
    let mut var_parts: u8 = 0;
    for c in emit_string.chars() {
      if var_parts == 2 {
        if c == '}' {
          out_string.pop();
          out_string.pop();
          *out_string += self.get_variable_value(
            &var_name,
            element_stack
          );
          var_name.clear();
          var_parts = 0;
        } else if !c.is_whitespace() {
          var_name.push(c);
        }
        continue
      } else if c == '@' && var_parts == 0 {
        var_parts += 1;
      } else if c == '{' && var_parts == 1 {
        var_parts += 1;
      } else {
        var_parts = 0;
      }
      out_string.push(c);
    }
  }

  /// Gets the value of a variable.
  /// If the variable is not found, an empty string is returned.
  fn get_variable_value<'a>(
    &self,
    var_name: &String,
    element_stack: &mut Vec<&'a Element>
  ) -> &'a str {
    for element in element_stack.iter().rev() {
      for (name, value) in &element.attributes {
        if name == var_name && value.is_some() {
          let ret = value.as_ref().unwrap().as_str();
          return if ret.starts_with('"') {
            &ret[1..ret.len() - 1]
          } else {
            ret
          }
        }
      }
    }
    return "";
  }

  fn indent(&self, out_string: &mut String, indent: Indent) {
    out_string.extend(iter::repeat(' ').take(indent as usize));
  }
}
