import { extname } from 'https://deno.land/std@0.165.0/path/mod.ts';
import { contentType } from 'https://deno.land/std@0.177.0/media_types/mod.ts';
import { compile } from './compile/compile.ts';
import { compileTS, startTSServer } from './compile/ts-server.ts';

// const FAVICON = 'AAABAAEAEB%4 EAIABoBAAAFgAAACg%4 Q%4 I%5 EAI%9 Q%1p gDZgKIA1YBg%11 /2y+z/9svv//bL7//2y+//9svv//bL7//2y+//9svv//bL7//2y+//9svv//bL7//2y+//9svv//bL7//2y+x/9svv+ANWAY%a D/bL7//22/r/9svv//bL7//2y+//9svv//bb+//2y+/w%a gDZfOP9svv//bL7H/2y+/w%4 D/bL7//2/APw%a /2y+//9svv8%a P9sv3f/bL7/%5 P9svv//bL6v%5 P9svv+ANl84/2y+/w%a /2y+//9wvxj/cL8g/2y+/w%a /2y+/w%4 D/bL7/%a D/bL+f/2y+//9svsc%5 /22+7/9svvc%a P9svv//bL7f%5 P9svuf/bL7//22/bw%f P9svv//bL7/%5 P9svv8%l /2y+/w%4 D/bL7//2y+/w%k D/b79//2y+//9svv//bL7//26/Zw%a /26/b/9svv//bL7//2y+/4A3X28%q P9svv+AOGAQ/2y+//9svv//bL7//2y+//9svv//bL7/%5 P9svv8%v D/bb7v/2y+//9svv8%l /2y+//9svv//bb7H%11 P9svv//bL7//2y+xw%a /2y+1/9svv//bL+f%1c /2y+//9svv//bL7//2y+//9svuf/bL7/%1h P9svY//bL7/%a D/bL7//2y/fw%1m /2y+//9tvt//bL7v/2y+/w%1w D/bL7//2y+/w%3e //8%7 BwDgAALnQAAK21AACJkwAAy9MAAOPHAADoFwAA48cAAPGPAAD4HwAA+b8AAPw/AAD+fwAA//8AAA=='.replace(/%.*? /g, e => "A".repeat(parseInt(e.slice(1, -1), 36)))

/** Text to be served, which overrides file access. */
export const serveText: {
  [key: string]: {
    data: () => string,
    type: string
  }
} = {};

/** Check if a path exists (as either a file or a directory.) */
async function exists(f: string): Promise<boolean> {
  try {
    await Deno.stat(f);
    return true;
  } catch {
    return false;
  }
}

async function getData(f: string): Promise<Deno.FileInfo | undefined> {
  try {
    return await Deno.stat(f);
  } catch { 0; }
}

/** Handles a single request, which only uses the given path. */
async function handleRequest(path: string, fullPath: string, silent?: boolean): Promise<Response> {
  // No more favicon
  if (path == 'favicon.ico')
    return new Response('You don\'t get a favicon.', { status: 404 });

  let throw404 = false;

  // Default to `index.spl`, then check `index.html` and finally send a directory.
  if (path.endsWith('/') || path.length == 0) {
    // If the path is into a directory, then great!
    if (await exists(path + 'index.spl')) path += 'index.spl';
    else if (await exists(path + 'index.html')) path += 'index.html';
    else if (await exists(path)) path += '[dir]';
    else throw404 = true;
  } else {
    // If it's not into a directory (directly)...
    const data = await getData(path);
    if (!data) {
      throw404 = true;
    } else if (data.isDirectory) {
      return Response.redirect(fullPath + '/', 302);
    }
  }

  // Log
  if (!silent) console.log(
    // The path that's being gotten
    '/' + path + ' ',

    // The current time as a string
    new Date().toTimeString().replace(/ \(.*/g, '')
  );

  // If the path is in the seveText dictionary...
  if (!throw404 && path in serveText) {
    const headers = new Headers();
    headers.set('Content-Type', serveText[path].type);
    return new Response(
      serveText[path].data() + '',
      { headers }
    );
  }

  // If it's a real file path
  if (!throw404 && path.endsWith('/[dir]')) {
    const dir = path.slice(0, -6);
    let ret = `<style>html{background-color:white;filter:invert(1)}*{font-family:monospace;margin-bottom:0}a{color:#0d4500}</style><h1 style="margin-top:20px">Directory Listing of ./${dir}</h1><br>\n`;
    for await (const f of Deno.readDir('./' + dir)) {
      ret += `<a href="${'./' + f.name}">${f.name}</a><br>\n`;
    }
    const headers = new Headers();
    headers.set('Content-Type', 'text/html');
    return new Response(ret, { status: 404, headers });
  } else try {
    let file: Uint8Array | string = await Deno.readFile(path);
    let sct = path.endsWith('.ts') ? 'text/javascript' : contentType(extname(path)) ?? 'text/plain';

    if (path.endsWith('spl')) {
      // Replace .spl files with compiled HTML
      file = await compile(new TextDecoder().decode(file), { filePath: path });
      sct = 'text/html';
    } else if (path.endsWith('.ts')) {
      // Replace .ts files with JavaScript
      file = await compileTS(
        new TextDecoder().decode(file),
        fullPath
      );
    }

    // Send the file over
    const headers = new Headers();
    headers.set('Content-Type', sct);
    return new Response(file, { headers });
  } catch {
    if (path.match(/\/.[^./]+$/) || !path.includes('.')) {
      // Check if file is actually a js resource (when no file extension found)
      return handleRequest(path + '.js', fullPath);
    } else if (path.endsWith('.js')) {
      // Check if file exists as `.ts` instead of `.js`
      return handleRequest(path.slice(0, -3) + '.ts', fullPath);
    }

    if (!silent) console.log(' > 404');
    return new Response('404: Not Found!', { status: 404 });
  }

  // return new Response("Something went wrong!", { status: 404 })
}

/** Handles a single connection to the server */
async function handleConnection(conn: Deno.Conn, opts: ServerOptions) {
  const httpConn = Deno.serveHttp(conn);
  try {
    for await (const requestEvent of httpConn) {
      // Craft the SpellsRequest object
      const { request } = requestEvent
        , url = new URL(request.url)
        , path = url.pathname.substring(1)
        , args: Record<string, string> = {};
      for (const [key, value] of url.searchParams.entries())
        args[key] = value;
      const splReq: SpellsRequest = {
        url: request.url, args,
        path: url.pathname.substring(1)
      };

      // Check through the routes...
      let tookRoute = false;
      for (const r of opts.routes ?? []) {
        if (!await r.capture(splReq)) continue;
        // A route was found! Send its output to the client
        requestEvent.respondWith(await r.routingFn(splReq, opts));
        tookRoute = true;
        break;
      }
      if (tookRoute) continue;

      // If no suitable route was found, use the default function
      requestEvent.respondWith(handleRequest(path, request.url, opts.silent));
    }
  } catch {
    // Connection was ended!
  }
}

interface ServerOptions {
  /** The port number of the server */
  readonly port: number

  /** The address of the server. Defaults to "localhost" */
  readonly bind?: string

  /** Wether or not the server emits any messages */
  readonly silent?: boolean

  /** The routing functions used whenever a request is received */
  readonly routes?: Route[]
}

interface Route {
  /** If this function returns true, the output is routed through this route. */
  capture: (req: SpellsRequest) => Promise<boolean> | boolean,

  /** If `capture` returns true, this function will be called. */
  routingFn: (req: SpellsRequest, opts: ServerOptions) => Promise<Response> | Response
}

/** Creates a simple route that matches a path string. */
function SimpleRoute(
  path: string,
  routingFn: (req: SpellsRequest, opts: ServerOptions) => Response
): Route {
  return {
    capture: (req: SpellsRequest) => req.path == path,
    routingFn
  };
}

interface SpellsRequest {
  /** The URL, just as it was passed to the server. */
  url: string

  /** The arguments passed through the URL arranged a dictionary */
  args: Record<string, string>

  /**
   * The path, without any of the hostname nor arguments.
   * Also note that the path doesn't start with a "/"
   */
  path: string
}

/** Start the server (non-blocking) */
export async function startServer(options: ServerOptions) {
  startTSServer();
  const listener = Deno.listen({ port: options.port });
  if (!options.silent) console.log(`Server running at http://${options.bind ?? 'localhost'}:${options.port}/`);
  for await (const conn of listener)
    handleConnection(conn, options);
}

// Start if this isn't an import
if (import.meta.main) {
  startServer({ port: 8081, routes: [
    SimpleRoute('someApi', _ => {
      const headers = new Headers();
      headers.set('Content-Type', 'text/json');
      return new Response(
        '{"working":true,"body":"It appears that everything is working!"}',
        { headers }
      );
    })
  ] });
}
