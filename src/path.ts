
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
      // Go back
      if (finalSpl.length == 0) {
        // Can't go further back, so just add it at the start
        back++;
      } else {
        // Pop from the path, going back
        finalSpl.pop();
      }
    } else if (p == '.' || p.length == 0) {
      // Ignore this path part
      continue;
    } else {
      // Push this part
      finalSpl.push(p);
    }
  }

  return (path[0] == '/' ? '/' : '') + '../'.repeat(back) + finalSpl.join('/');
}

export function calcRelative(from: string, to: string): string {
  from = prettyPath(from);
  to = prettyPath(to);

  // If the paths are equal, we're already there.
  if (from === to) return '';
  
  // Split the paths into their steps
  const fromParts = from.split('/');
  const toParts = to.split('/');

  const outParts: string[] = [];

  // Step 1: go to the common parent directory
  for (;;) {
    let isEqual = true;
    for (let i = 0; i < fromParts.length; i++) {
      if (toParts[i] != fromParts[i]) {
        isEqual = false;
        break;
      }
    }
    if (isEqual) break;

    // Move back
    fromParts.pop();
    outParts.push('..');
  }

  // Step 2: go from there to the final path
  for (let i = fromParts.length; i < toParts.length; i++) {
    outParts.push(toParts[i]);
  }

  return outParts.join('/');
}

// These are here for future compatibility!

export function readTextFile(path: string) {
  return Deno.readTextFile(prettyPath(path));
}

export function readTextFileSync(path: string) {
  return Deno.readTextFileSync(prettyPath(path));
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
