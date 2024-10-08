import { error } from '../logging.ts';
import { calcRelative, pathGoUp, prettyPath } from '../path.ts';
import { CompileOptions } from './compile-options.ts';
import { linkAttributes, tagNoMarkDown, tagSingle } from './special-tags.ts';

/** A virtual element structure */
export interface Element {
  tagName: string
  file: string
  attrs?: Record<string, string>
  clss?: string[]
  id?: string
  innerText?: string
  children?: Element[]
  singleTag?: boolean
  notMarkDown?: boolean
  multiline?: boolean
}

/**
 * Converts a character index to the corresponding line and column in the
 * source string.
 */
function idxToPos(src: string, idx: number): string {
  const matches = [...src.matchAll(/\n/g)]
    , lineNum = matches.findIndex(m => m.index! > idx) ?? 0
    , colNum = idx - matches[lineNum - 1].index!;
  return (lineNum + 1) + ':' + colNum;
}

/**
 * Splits a string of attributes passed to a tag into separate strings
 * @param attr The attributes to be split
 * @returns The separated strings
 */
function splitModifiers(attr: string): string[] {
  const modifiers: string[] = [];
  let curr = '';
  function push() {
    if (curr.length == 0) return;
    modifiers.push(curr), curr = '';
  }
  for (let i = 0; i < attr.length; i++) {
    if (attr[i] == '"') {
      curr += attr[i];
      while (attr[++i] != '"')
        curr += attr[i];
      curr += attr[i++];
    }
    if ('.#('.includes(attr[i])) push();
    curr += attr[i];
  }
  push();
  return modifiers;
}

/** Characters that can be used inside a tag name. */
const nameChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXZY0123456789_-@';

function isAttributeLink(attr: string): boolean {
  for (const la of linkAttributes) {
    if (attr.match(la)) return true;
  }
  return false;
}

/**
 * Parses a string into an element structure.
 * @param code The code we're parsing
 * @param indent The level of indentation that we're checking 
 * @returns The element structure, along with the index of the last character
 * that it parsed
 */
export function parse(
  code: string,
  compileOptions: CompileOptions,
  indent = 0,
  startI = 0,
  parentVariables?: Record<string, string>,
): [ Element[], number ] {
  // Properly indent the code (using tabs)
  if (!code.includes('\t')) {
    // Get the indent size
    let indentSize = 4; // Default to 4
    for (const line of code.split('\n')) {
      const m = line.match(/[^ ]/);
      if (m && m.index != 0) {
        indentSize = m.index!;
        break;
      }
    }
    const r = new RegExp(`^(${' '.repeat(indentSize)}){1,}`, 'gm');
    code = (code + '\n').replace(r, e => '\t'.repeat(e.length / indentSize));
  }

  const els: Element[] = [];
  let tagIndent = 0,
    tagName = '',
    i = startI;
  for (; i < code.length; i++) {
    const c = code[i]; // Get the character we're on

    // If the character is a "tag name character", add it to the tag name
    if (nameChars.includes(c) || c == '/') {
      tagName += c;
      continue;
    }
    
    if (tagName.startsWith('//')) {
      // Deal with comments
      if (c == '\n') {
        // If thre's a newline, stop the comment
        tagName = '';
        tagIndent = 0;
      }
      continue;
    }

    // If a tab is found, increase the indent level
    if (c == '\t') tagIndent++;
    
    if (tagName.length == 0) {
      // If there's no tag (so just a tab), don't let the code below run
      if (c == '\n') {
        // If thre's a newline and no tag, reset the indentation
        tagIndent = 0;
      }
      continue;
    }

    /// ONCE WE HAVE A TAG,

    // If a tag is found before the expected indent, break out of the loop.
    // This makes the element be processed by the outer function.
    if (tagIndent < indent) {
      i -= tagName.length + 1 + tagIndent;
      break;
    }

    // Get the things that are a part of the tag: class,
    // ID, and attributes. (+ the multi-line operator)
    let j = i, nest = 0;
    for (;;) {
      if ((code[j] == '\n' || code[j] == ' ' || j >= code.length) && nest == 0) break;
      if (code[j] == '(' || code[j] == '[' || code[j] == '{') nest++;
      else if (code[j] == ')' || code[j] == ']' || code[j] == '}') nest--;
      if (++j > code.length) error('Unmatched nest:', idxToPos(code, i));
    }
    const thingsString = code.slice(i, j); i = j;
    const things = splitModifiers(thingsString.trim());

    // Get the attributes
    const attrs: Record<string, string> = {};
    things.filter(t => t[0] == '(').forEach(a => {
      const appendAttributes: string[] = [];
      const splitString = a.slice(1, -1);
      let curr = '';

      for (let i = 0; i < splitString.length; i++) {
        if (splitString[i] == ',' || splitString[i] == ' ') {
          if (curr.length == 0) continue;
          appendAttributes.push(curr);
          curr = '';
          continue;
        } else if (splitString[i] == '"') {
          curr += splitString[i];
          while (splitString[++i] != '"')
            curr += splitString[i];
          curr += splitString[i];
          continue;
        }
        curr += splitString[i];
      }
      if (curr.length > 0) appendAttributes.push(curr);
      
      appendAttributes.forEach(attributeString => {
        const attributeParts = attributeString.split('='),
          attr = attributeParts[0].trim();
        let val = attributeParts.slice(1).join('=');

        // Fix relative paths in imports
        // Hours spent here (including all the functions it calls!): 3
        if (isAttributeLink(attr) && compileOptions.mapPaths) {
          if (val.startsWith('"') || val.startsWith('\'')) {
            val = val.slice(1, -1);
          }
          val = '"./' + prettyPath(calcRelative(
            pathGoUp(compileOptions.mapPaths),
            pathGoUp(compileOptions.filePath)
          ) + '/' + val) + '"';
        }

        attrs[attr] = val;
      });
    });
    const variables = { ...attrs, ...parentVariables };

    // Get innerText / children
    const children: Element[] = [];
    let innerText: string | undefined;
    const isMultiline = things[things.length - 1] == '.';
    if (isMultiline) {
      // If it ends with a dot, capture multiple lines of text after it
      const matches = [ ...code.matchAll(
        new RegExp(`^\t{0,${indent}}(?!\t)(?!$)`, 'gm')
      ) ];
      const endIndex = (
        matches.find(m => m.index! >= i) ?? { index: code.length - 1 }
      ).index! - 1;
      innerText = code.slice(i + 1, endIndex);
      i = endIndex;
    } else {
      // If the string isn't multiline, it could still have some text right after the tag

      // Take the innerText
      let until = code.indexOf('\n', i);
      until = until == -1 ? code.length : until;
      innerText = code.slice(i + 1, until);
      i = until;

      if (until != code.length) {
        // After the innerText, tags may have children
        const [elements, finishI] = parse(code, compileOptions, indent + 1, i, variables);
        children.push(...elements);
        i = finishI;
      }
    }

    // Finally, push the element!
    els.push({
      tagName, attrs,
      file: compileOptions.filePath,
      clss: things
        .filter(t => t[0] == '.' && t.length > 1)
        .map(c => c.slice(1)),
      id: things.filter(t => t[0] == '#')[0]?.slice(1),
      innerText,
      children,
      notMarkDown: tagNoMarkDown.includes(tagName),
      singleTag: tagSingle.includes(tagName),
      multiline: isMultiline
    });
    tagName = '';
    tagIndent = 0;
  }
  return [ els, i ];
}
