use wasm_bindgen::prelude::*;
use crate::compile::{compiler, options::CompileOptions, markdown};
use std::fmt;

#[wasm_bindgen]
pub struct SpellsCompiler {
    options: CompileOptions,
}

#[wasm_bindgen]
impl SpellsCompiler {
    #[wasm_bindgen(constructor)]
    pub fn new(pretty: bool) -> SpellsCompiler {
        SpellsCompiler {
            options: CompileOptions { pretty },
        }
    }

    /// Compile SPL source code to HTML
    #[wasm_bindgen]
    pub fn compile_spl(&self, source: String) -> Result<String, JsError> {
        compiler::build_source_string(&self.options, source)
            .map_err(|e| JsError::new(&format!("{}", e)))
    }

    /// Compile TypeScript source code to JavaScript
    /// Note: This is a placeholder - TypeScript compilation requires additional setup
    #[wasm_bindgen]
    pub fn compile_ts(&self, source: String) -> Result<String, JsError> {
        // TODO: Integrate TypeScript compilation
        // For now, return the source as-is
        Ok(source)
    }

    /// Compile markdown to HTML
    #[wasm_bindgen]
    pub fn compile_markdown(&self, source: String) -> Result<String, JsError> {
        use crate::compile::tokenizer::Indent;
        Ok(markdown::compile_markdown(&source, 0 as Indent))
    }
}

/// Standalone function to compile SPL to HTML
#[wasm_bindgen]
pub fn compile_spl(source: String, pretty: bool) -> Result<String, JsError> {
    let options = CompileOptions { pretty };
    compiler::build_source_string(&options, source)
        .map_err(|e| JsError::new(&format!("{}", e)))
}

/// Standalone function to compile markdown to HTML
#[wasm_bindgen]
pub fn compile_markdown(source: String) -> String {
    use crate::compile::tokenizer::Indent;
    markdown::compile_markdown(&source, 0 as Indent)
}

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[wasm_bindgen]
pub fn greet(name: &str) {
    log(&format!("Hello, {}!", name));
}
