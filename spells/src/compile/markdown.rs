use super::tokenizer::Indent;
use markdown;

pub fn compile_markdown(md: &String, _indent: Indent) -> String {
  markdown::to_html(md)
}
