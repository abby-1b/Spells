
/**
 * Goes up a single level in a path.
 * e.g.
 * `/some/dir` => `some/`
 * `/some/file.ext` => `some/`
 * @param path The path we're traversing
 * @returns The path, without the last level
 */
export function pathGoUp(path: string) {
  const endsWithSlash = path.endsWith('/');
  return path.split('/').slice(0, endsWithSlash ? -2 : -1).join('/') + '/';
}

/**
 * Resolves a path
 * e.g. `some/path/that/../goes/../here` => `some/path/here`
 * @param path The path we're resolving
 * @returns The resolved path
 */
export function prettyPath(path: string) {
  const finalSpl: string[] = [];
  let back = 0;
  for (const p of path.split('/')) {
    if (p == '..') {
      if (finalSpl.length == 0) back++;
      else finalSpl.pop();
    } else if (p == '.' || p.length == 0) {
      continue;
    } else {
      finalSpl.push(p);
    }
  }

  return '../'.repeat(back) + finalSpl.join('/');
}

// This was taken (and edited) from https://deno.land/std@0.201.0/path/mod.ts
export function calcRelative(from: string, to: string) {
  from = prettyPath(from);
  to = prettyPath(to);
  console.log('Calculating:', {from, to});
  
  if (from === to) return '';
  
  const toLen = to.length;
  
  const length = from.length < toLen ? from.length : toLen;
  let lastCommonSep = -1;
  let i = 0;
  for (; i <= length; i++) {
    if (i === length) {
      if (toLen > length) {
        if (to[i] == '/') {
          return to.slice(i + 1);
        } else if (i === 0) {
          return to.slice(i);
        }
      } else if (from.length > length) {
        if (from[i] == '/') {
          lastCommonSep = i;
        } else if (i === 0) {
          lastCommonSep = 0;
        }
      }
      break;
    }
    const fromCode = from[i];
    const toCode = to[i];
    if (fromCode !== toCode) break;
    else if (fromCode == '/') lastCommonSep = i;
  }
  
  let out = '';
  for (i = lastCommonSep + 1; i <= from.length; i++) {
    if (i === from.length || from[i] == '/') {
      if (out.length === 0) out += '..';
      else out += '/..';
    }
  }
  
  if (out.length > 0) {
    return out + to.slice(lastCommonSep);
  } else {
    let toStart = lastCommonSep;
    if (to[toStart] == '/') toStart++;
    return to.slice(toStart);
  }
}

// These are here for future compatibility!

export function readTextFile(path: string) {
  return Deno.readTextFile(path);
}

export function readTextFileSync(path: string) {
  return Deno.readTextFileSync(path);
}

export async function readDir(path: string) {
  const ret = [];
  for await (const f of Deno.readDir(path)) {
    ret.push(f);
  }
  return ret;
}

export function readDirSync(path: string) {
  return Deno.readDirSync(path);
}
