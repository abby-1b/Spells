use std::collections::HashSet;

use super::{error::CompilerError, tokenizer::{Indent, Tokenizer}};

#[derive(Debug, Clone)]
enum ElementContent {
  Empty,
  Children(Vec<Element>),
  InnerText(String)
}

/// A spells element references 
#[derive(Debug, Clone)]
pub struct Element {
  tag_name: String,
  id: Option<String>,
  classes: Vec<String>,
  attributes: Vec<(String, Option<String>)>,
  content: ElementContent,
}

/// A frame of the parser, used for keeping components in scope
struct Frame {
  components: Vec<Element>,
}

enum ElementReturn {
  Element(Element),
  Component(Element),
  EndOfFile
}


pub struct Parser {
  frames: Vec<Frame>,
}

impl Parser {
  pub fn new() -> Parser {
    Parser {
      frames: vec![]
    }
  }

  pub fn parse(
    &mut self,
    tokenizer: &mut Tokenizer
  ) -> Result<Vec<Element>, CompilerError> {

    // Get the starting indentation
    let start_indent = tokenizer.consume_indent().0;
    if start_indent != 0 {
      return Err(CompilerError::IndentationError(format!(
        "Expected 0 indentation in start of file, found {}.",
        start_indent
      )));
    }

    Ok(self.inner_parse(tokenizer, 0)?)
  }

  fn inner_parse(
    &mut self,
    tokenizer: &mut Tokenizer,
    indent: Indent
  ) -> Result<Vec<Element>, CompilerError> {
    // Push a new frame
    self.frames.push(Frame {
      components: vec![]
    });

    let mut elements: Vec<Element> = vec![];

    loop {
      match self.parse_single_element(tokenizer, indent)? {
        ElementReturn::Component(c) => {
          if matches!(c.content, ElementContent::Empty) {
            if let Some(template) = self.get_component(&c.tag_name) {
              elements.push(hydrate_component(c, template));
            }
          } else {
            self.add_component(c);
          }
        },
        ElementReturn::Element(e) => elements.push(e),
        ElementReturn::EndOfFile => break
      }

      if tokenizer.peek_indent().0 < indent {
        break;
      }
    }

    // Pop the frame
    self.frames.pop();

    Ok(elements)
  }

  /// Parses a single element
  fn parse_single_element(
    &mut self,
    tokenizer: &mut Tokenizer,
    indent: Indent,
  ) -> Result<ElementReturn, CompilerError> {

    // Get the starting tag name (default to `div`)
    let tag_name = match tokenizer.peek() {
      Some("." | "#" | "(") => { "div".to_owned() }
      Some(_) => { tokenizer.consume().unwrap().to_owned() }
      None => { return Ok(ElementReturn::EndOfFile); }
    };

    let mut content_parsed: bool = false;
    let mut is_component: bool = false;

    let mut id: Option<String> = None;
    let mut classes: Vec<String> = vec![];
    let mut attributes: Vec<(String, Option<String>)> = vec![];
    let mut content: ElementContent = ElementContent::Empty;
    loop {
      match tokenizer.peek() {
        Some("#") => {
          // Id
          tokenizer.consume();
          id = tokenizer.consume().map(String::from);
        }
        Some(".") => {
          tokenizer.consume();
          if let Some(c) = tokenizer.consume() {
            // Class declaration
            classes.push(c.to_owned())
          } else {
            // Multiline
            content_parsed = true;
            if tokenizer.peek_indent().0 < indent {
              // No content
              break;
            }

            let mut inner_text = "".to_owned();
            let normal_indent = tokenizer.consume_indent().0;

            loop {
              // Get a single line
              if let Some(line) = tokenizer.consume_line() {
                inner_text += &line;
                // TODO: why does this line function not take the leading whitespace?
              }

              // Get the next indent
              let next_indent = tokenizer.peek_indent();
              if next_indent.0 <= indent {
                break;
              }

              // Add newlines & next indent
              let extra_indent = (next_indent.0 - normal_indent) as usize;
              inner_text.reserve(next_indent.1 + extra_indent);
              inner_text.extend(std::iter::repeat('\n').take(next_indent.1));
              inner_text.extend(std::iter::repeat(" ").take(extra_indent));
            }

            // Get the remaining indent
            tokenizer.consume_indent();
            tokenizer.peek_indent();

            content = ElementContent::InnerText(inner_text);

            break;
          }
        }
        Some("(") => {
          // Attributes
          tokenizer.consume_ignore_newline();
          while !matches!(tokenizer.peek_ignore_newline(), Some(")")) {
            let name = match tokenizer.consume_ignore_newline() {
              Some(name) => name.to_owned(),
              None => break
            };
            let value = if tokenizer.peek_ignore_newline().is_some_and(|t| t == "=") {
              tokenizer.consume_ignore_newline();
              tokenizer.consume_ignore_newline().map(String::from)
            } else {
              None
            };
            if name == "@" { is_component = true; }
            attributes.push((name, value));
            if matches!(tokenizer.peek_ignore_newline(), Some(",")) {
              tokenizer.consume_ignore_newline();
            }
          }
          tokenizer.consume();
        }
        Some(_) => {
          // Single-line text
          if let Some(inner_text) = tokenizer.consume_line() {
            content = ElementContent::InnerText(inner_text.to_owned());
          }
          break;
        }
        None => { break; }
      }
    }

    if !content_parsed && tokenizer.peek_indent().0 > indent {
      let inner_indent = tokenizer.consume_indent().0;
      let inner_elements = self.inner_parse(tokenizer, inner_indent)?;
      if !inner_elements.is_empty() {
        content = ElementContent::Children(inner_elements);
      }
    }

    let element = Element {
      tag_name,
      id,
      classes: pack_vec(classes),
      attributes: pack_vec(attributes),
      content
    };

    if is_component {
      Ok(ElementReturn::Component(element))
    } else {
      Ok(ElementReturn::Element(element))
    }
  }

  /// Adds a component, which can be used within
  /// the current scope and all child scopes.
  fn add_component(&mut self, component: Element) {
    self.frames.last_mut().unwrap().components.push(component);
  }

  /// Gets a component given its name
  fn get_component(&mut self, name: &str) -> Option<&mut Element> {
    // Look through each frame (front to back)
    for frame in self.frames.iter_mut().rev() {
      for component in frame.components.iter_mut() {
        if component.tag_name == name {
          return Some(component)
        }
      }
    }

    // Component not found...
    None
  }
}

/// Puts the information from a component instance into the component template.
/// This only includes classes and ids, not variables.
fn hydrate_component(mut instance: Element, template: &Element) -> Element {
  // Add the component name to the classes
  instance.classes.push(instance.tag_name);
  
  Element {
    tag_name: "div".to_owned(),
    id: instance.id.or_else(|| template.id.clone()),
    classes: pack_vec(combine_vecs(&instance.classes, &template.classes)),
    attributes: pack_vec(combine_vecs(&instance.attributes, &template.attributes)),
    content: template.content.clone(),
  }
}

fn combine_vecs<
  T: std::clone::Clone + std::hash::Hash + std::cmp::Eq
>(a: &Vec<T>, b: &Vec<T>) -> Vec<T> {
  let mut hashset: HashSet<T> = HashSet::with_capacity(a.len() + b.len());
  for e in a.iter().chain(b) { hashset.insert(e.clone()); }

  hashset
    .into_iter()
    .collect::<Vec<T>>()
}

fn pack_vec<T>(v: Vec<T>) -> Vec<T> {
  let capacity = v.capacity();
  if v.len() == capacity {
    v
  } else {
    let mut new_vec = Vec::with_capacity(capacity);
    new_vec.extend(v);
    new_vec
  }
}
