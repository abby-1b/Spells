use std::iter;

use super::{markdown::{compile_markdown, compile_half_markdown}, options::CompileOptions, parser::{Element, ElementContent}, tokenizer::Indent};

// --- Statics remain the same ---
static INDENT_AMOUNT: Indent = 2;
static UNCLOSED_TAGS: &[&str] = &[
  "br",
  "img",
  "meta",
  "wbr",
  "link"
];
static NO_MARKDOWN: &[&str] = &[
  "style",
  "css",
  "script",
  "title",
];

// --- Public Emitter (Stateless) ---
// This struct stays the same, holding only configuration.
pub struct Emitter<'a> {
  options: &'a CompileOptions,
}

impl<'a> Emitter<'a> {
  pub fn new(options: &'a CompileOptions) -> Emitter<'a> {
    Emitter {
      options
    }
  }

  /// Emits the final HTML string.
  /// This function now creates a temporary stateful emitter
  /// to manage the string building and element stack.
  pub fn emit(&mut self, expected_capacity: usize, elements: Vec<Element>) -> String {
    let mut emit_state = EmitState::new(
      &self.options,
      expected_capacity
    );
    emit_state.run(&elements)
  }
}

// --- Internal EmitState (Stateful) ---
/// This struct holds the state of a single emission pass.
/// The lifetime 'a is tied to the elements being processed.
/// The lifetime 'b is tied to the compile options.
struct EmitState<'a, 'b> {
  options: &'b CompileOptions,
  out_string: String,
  element_stack: Vec<&'a Element>,
}

impl<'a, 'b> EmitState<'a, 'b> {
  /// Creates a new stateful emitter.
  fn new(options: &'b CompileOptions, capacity: usize) -> Self {
    Self {
      options,
      out_string: String::with_capacity(capacity),
      element_stack: Vec::new(),
    }
  }

  /// Runs the emission process and consumes the state,
  /// returning the final string.
  fn run(mut self, elements: &'a [Element]) -> String {
    self.out_string += "<!DOCTYPE html>\n";
    self.emit_inner(elements, 0);
    self.out_string
  }

  /// Recursively emits elements.
  /// Note: No more `out_string` or `element_stack` parameters!
  fn emit_inner(
    &mut self,
    elements: &'a [Element], // Use slice
    indent: Indent
  ) {
    for element in elements {
      if element.tag_name == "doctype" || element.tag_name == "/" {
        continue;
      }
      
      self.element_stack.push(element);
      self.emit_single_element(indent);
      self.element_stack.pop();
    }
  }

  /// Emits a single element, its content, and its closing tag.
  fn emit_single_element(
    &mut self,
    indent: Indent
  ) {
    let pretty = self.options.pretty;
    if pretty { self.indent(indent); }

    let element = *self.element_stack.last().unwrap();
    let tag_name = element.tag_name.as_str();

    // --- Open Tag ---
    self.out_string += "<";
    self.out_string += tag_name;
    if let Some(id) = &element.id {
      self.out_string += " id=\"";
      self.out_string += id;
      self.out_string += "\"";
    }
    for attribute in &element.attributes {
      self.out_string += " ";
      self.out_string += &attribute.0;
      if let Some(equals) = &attribute.1 {
        self.out_string += "=";
        self.emit_with_vars(equals);
      }
    }
    if !element.classes.is_empty() {
      self.out_string += " class=\"";
      for class in &element.classes {
        self.out_string += class;
        self.out_string += " ";
      }
      self.out_string.pop();
      self.out_string += "\"";
    }
    self.out_string += ">";

    // --- Content ---
    match &element.content {
      ElementContent::Empty => {},
      ElementContent::InnerText(inner_text) => {
        if pretty { self.out_string += "\n"; }
        if element.has_attribute("#") {
          self.emit_markdown(inner_text, indent);
        } else if NO_MARKDOWN.contains(&tag_name) {
          self.emit_plaintext(inner_text, indent);
        } else {
          self.emit_basic_style(inner_text, indent);
        }
      }
      ElementContent::Children(children) => {
        if pretty { self.out_string += "\n"; }
        // The recursive call is now clean and doesn't
        // conflict with the `element` borrow.
        self.emit_inner(
          children,
          indent + INDENT_AMOUNT
        );
      }
    }

    // --- Close Tag ---
    if !UNCLOSED_TAGS.contains(&tag_name) {
      if pretty { self.indent(indent); }
      self.out_string += "</";
      self.out_string += tag_name;
      self.out_string += ">";
    }

    if pretty { self.out_string += "\n"; }
  }

  /// Emits full markdown.
  fn emit_markdown(
    &mut self,
    md: &String,
    indent: Indent,
  ) {
    self.out_string += &compile_markdown(md, indent);
    self.out_string += "\n";
  }

  /// Emits basic styled text.
  fn emit_basic_style(
    &mut self,
    text: &String,
    indent: Indent,
  ) {
    self.out_string += &compile_half_markdown(text, indent);
    self.out_string += "\n";
  }

  /// Emits plaintext.
  fn emit_plaintext(
    &mut self,
    plaintext: &String,
    indent: Indent,
  ) {
    self.out_string += &plaintext;
    self.out_string += "\n";
  }

  /// Emits a string, processing embedded variables.
  fn emit_with_vars(
    &mut self,
    emit_string: &String
  ) {
    let mut var_name = String::with_capacity(emit_string.len());
    let mut var_parts: u8 = 0;
    for c in emit_string.chars() {
      if var_parts == 2 {
        if c == '}' {
          self.out_string.pop();
          self.out_string.pop();
          // `get_variable_value` now only takes `&self`
          self.out_string += self.get_variable_value(&var_name);
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
      self.out_string.push(c);
    }
  }

  /// Gets the value of a variable.
  /// This function now takes `&self` and reads from `self.element_stack`.
  fn get_variable_value(
    &self, // Note: &self, not &mut self
    var_name: &String,
  ) -> &'a str {
    for element in self.element_stack.iter().rev() {
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

  /// Appends indentation to the output string.
  fn indent(&mut self, indent: Indent) {
    self.out_string.extend(iter::repeat(' ').take(indent as usize));
  }
}