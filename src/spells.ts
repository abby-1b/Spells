import { startServer } from './server.ts';
import { compileTS, startTSServer } from './compile/ts-server.ts';
import { compile } from './compile/compile.ts';
import { logStyle, warning } from './logging.ts';
import { pathGoUp, readTextFile, readTextFileSync } from './path.ts';

/**
 * The compiler version (1st) changes when there's any API breaking changes.
 * The 'build' number (2nd) changes whenever anything new is added.
 */
export const VERSION = (() => {
  try {
    return readTextFileSync(pathGoUp(new URL(import.meta.url).pathname) + 'VERSION')
      .trim();
  } catch {;}

  return "[unknown]";
})();

const COMMANDS: { [key: string]: string[] } = {
  'help, h, (empty)': [ 'Shows this dialogue' ],
  'version, v': [ 'Shows the version number' ],

  'server, serve, s  [port] [--bind] [--silent]': [
    'Starts a server, accepting an optional argument for the port.',
    'The default port is :8080',
    'bind: sets the address that we\'re outputting to.',
    'silent: stops the server from emitting messages'
  ],

  'build, b  buildDir  outDir [--final]': [
    'Builds the site to vanilla HTML and JS.',
    'final: minifies before exporting, removing source maps and minifying variable names.'
  ]
};

/** The passed arguments. */
const args = [...Deno.args];

async function getFiles(path: string) {
  if (!path.endsWith('/')) path += '/';
  const ret: { path: string, isDir: boolean }[] = [];
  for (const f of Deno.readDirSync(path)) {
    if (f.isFile) {
      ret.push({ path: path + f.name, isDir: false });
    } else {
      ret.push({ path: path + f.name, isDir: true });
      ret.push(...await getFiles(path + f.name));
    }
  }
  return ret;
}

if (args.length == 0 || args[0][0] == 'h') {
  // Help
  logStyle('font-weight: bold', 'Spells v' + VERSION);
  console.log('\nCommands:');
  for (const c in COMMANDS) {
    logStyle('color: blue; font-weight: bold', '    ' + c);
    for (const l of COMMANDS[c]) {
      logStyle(l.startsWith('--') ? 'color: yellow' : '', '        ' + l);
    }
    console.log();
  }
  Deno.exit();
} else if (args[0][0] == 'v') {
  logStyle('font-weight: bold', 'Spells v' + VERSION);
  Deno.exit();
} else if (args[0][0] == 's') {
  // Server
  const port = args.length > 1 ? parseInt(args[2]) : 8080;
  startServer({
    port
  });
  // TODO: acknowledge --bind and --silent
} else if (args[0][0] == 'b') {
  // Build
  if (args.length < 3) {
    warning('Please provide an input and output directory.');
  } else {
    const buildDir = args[1]
      , outDir = args[2]
      , final = args.length > 3 ? args.includes('final') : false;
    
    // Get the files
    const buildFiles = await getFiles(buildDir);

    // If there's a TypeScript file, start the TypeScript server preemptively
    if (buildFiles.map(e => e.path.endsWith('.ts') && !e.isDir).includes(true)) {
      startTSServer();
    }

    // Empty the output directory
    try { await Deno.remove(outDir, { recursive: true }); } catch { 0; }
    await Deno.mkdir(outDir);

    // One by one, output the files. Compile them is necessary.
    for (const from of buildFiles) {
      const to = outDir + '/' + from.path.split('/').slice(1).join('/');
      if (from.isDir) {
        // Make a directory
        await Deno.mkdir(to);
      } else if (to.endsWith('.spl')) {
        // Compile .spl files
        const d = await readTextFile(from.path);
        await Deno.writeTextFile(
          to.replace(/\.spl$/, '.html'),
          await compile(d, {
            convertExtensionTStoJS: true,
            filePath: from.path
          })
        );
      } else if (to.endsWith('.ts')) {
        // Compile .ts files
        const d = await readTextFile(from.path);
        await Deno.writeTextFile(
          to.replace(/\.ts$/, '.js'),
          await compileTS(
            d,
            final ? undefined : from.path.split('/').slice(-1)[0],
            final
          )
        );
      } else {
        // Else, just copy the file
        Deno.copyFile(from.path, to);
      }
    }
  }
} else {
  logStyle('color: red', 'Unknown argument:', args[0]);
}
