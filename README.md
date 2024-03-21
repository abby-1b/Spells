![Banner](./assets/banner.png)

# **Spells**: A fast web development server

Spells is a tool that allows for quick iteration and development of web
applications. It allows you to write a combination of JavaScript, TypeScript,
HTML, Markdown, and Pug/Jade to develop websites much faster.

Spells' main feature is its web server. It allows you to write in all of these
languages and quickly test everything in real time. To run the web server,
simply run `spl s` (faster than writing `python3 -m http.server`, huh?)


# Install

To install Spells, follow the instructions [here](./INSTALL.md). Windows is
currently unsupported, but support is planned.


# Design

## Markup language

Spells (the tool) comes with its own own language: Spells (the markup language).

It's a subset of Pug/Jade, a language similar to VSCode's Emmet abbreviations.
This greatly reduces the amount of code typed and overall looks less cluttered
than pure HTML:

```jade
head
  title My Website!
  script(src="someScript.js")
body
  h1 This content is in one line...
  h2.
    This content can span
    multiple lines!
```


## TypeScript

The main design goal of this tool is to allow mixing different languages within
the same project. You can, for example, put TypeScript inside your HTML script
tags, which compiles down to its JavaScript equivalent:

```jade
script.
  // No need for a type="TypeScript" specifier!
  class SomeClass {
    public foo: number;
    private bar: string;
  }
  const a: Array<SomeClass> = [];
  a.push(new SomeClass());
```

Alternatively, you can import TypeScript files directly:

```pug filename="index.spl"
script(src="someFile.ts")
```

```ts filename="someFile.ts"
const a: number = 123;
```

This currently uses [Speedy Web Compiler](https://swc.rs/), a fast TypeScript
compiler written in Rust. Optionally, there's support for my own compiler,
[RSTSC](https://github.com/abby-1b/rstsc).

## Markdown

Markdown provides a simple way of styling text. When writing text in Spells, you
can include markdown at any point, and it will be converted to its equivalent
HTML when it's compiled:

```jade
h1.
  You can *italicize* words, make them **bold**, or ***both***.
```

Which looks like the following:

You can *italicize* words, make them **bold**, or ***both***.

Do keep in mind that this is a subset of the [Markdown spec](https://spec-md.com/).

