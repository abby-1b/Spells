#!/bin/bash

# Build script for Spells WebAssembly compilation

echo "Building Spells WebAssembly module..."

# Check if wasm-pack is installed
if ! command -v wasm-pack &> /dev/null; then
  echo "Installing wasm-pack..."
  cargo install wasm-pack
fi

# Build the WebAssembly module
cd spells
wasm-pack build --target web --out-name spells_wasm --out-dir ../web

# Check if build was successful
if [ $? -eq 0 ]; then
  echo "WebAssembly build successful!"
  echo "Files generated in web/ directory:"
  ls -la ../web/spells_wasm*
else
  echo "WebAssembly build failed!"
  exit 1
fi

echo ""
echo "To test the WebAssembly module:"
echo "1. Start a local web server in the web/ directory:"
echo "   cd web && python3 -m http.server 8000"
echo "2. Open http://localhost:8000 in your browser"
echo "3. Try compiling the example SPL and markdown code"
