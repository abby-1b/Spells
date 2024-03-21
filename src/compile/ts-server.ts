
const USE_RSTSC = false;

/**
 * Compiles TypeScript code
 * @param source The code to be compiled
 * @param fileName The name of the file, used for source mapping
 * @param minify Whether or not to minify
 * @returns The outputted JavaScript code
 */
export let compileTS = async (
  source: string,
  fileName?: string,
  minify?: boolean
): Promise<string> => {
  await startTSServer();
  return compileTS(source, fileName, minify);
};

const wait = (time = 500) => new Promise(resolve => setTimeout(resolve, time));

let startedTSServer = 0; // 0: not started, 1: starting, 2: started
/** Starts the TypeScript compilation server */
export async function startTSServer() {
  // If it's already started, return immediately
  if (startedTSServer == 2) return;
  if (startedTSServer == 1) {
    // If it's starting, wait for it to be initialized fully
    while (startedTSServer == 1) await wait();
    return;
  }

  if (USE_RSTSC) {
    // Start up the RSTSC server...
    startedTSServer = 1;
    const serverPath = new URL(import.meta.url).pathname.split('/')
      .slice(0, -4).join('/') + '/rstsc/ts_compile/target/release/ts_compile';
    const serverInstance = new Deno.Command(serverPath);
    serverInstance.spawn();
    
    compileTS = async (
      source: string,
      fileName?: string,
      minify?: boolean
    ): Promise<string> => {
      const socketClient = new WebSocket('ws://localhost:7787', 'rust-websocket');
      let ready: number = 0;

      socketClient.onopen = () => {
        console.log('Connected!');
        ready = 1;
      };
      while (ready != 1) await wait(10);

      socketClient.send(source);
      let outString = '';
      socketClient.onmessage = (m) => {
        outString = m.data;
        ready = 2;
      };
      while (ready as unknown != 2) await wait(10);

      console.log('Sent out!', outString);

      return outString;
    };
    return;
  }

  // If this is the first time we're starting it, let the others know
  startedTSServer = 1;
  const innerTransform =
    (await import('https://deno.land/x/swc@0.2.1/mod.ts')).transform;
  startedTSServer = 2;
  console.log('TypeScript compiler loaded!');
  
  // deno-lint-ignore require-await
  compileTS = async (
    source: string,
    fileName?: string,
    minify?: boolean
  ): Promise<string> => {
    const ret = innerTransform(source, {
      jsc: {
        target: 'es2022',
        parser: {
          syntax: 'typescript',
          tsx: true,
          dynamicImport: true
        },
        minify: minify ? {
          compress: {
            arguments: true,
            arrows: true,
            booleans: true,
            collapse_vars: true,
            comparisons: true,
            conditionals: true,
            defaults: false,
            drop_console: true,
            drop_debugger: true,
            ecma: 5,
            hoist_props: true,
            if_return: true,
            inline: 0,
            join_vars: true,
            keep_classnames: true,
            keep_fargs: false,
            keep_fnames: true,
            keep_infinity: false,
            loops: true,
            passes: 3,
            properties: true,
            sequences: 20,
            side_effects: true,
            switches: true,
            typeofs: true,
            unsafe_math: true,
          }
        } : {}
      },
      // Only include source maps if a filename is given
      sourceMaps: !!fileName,
      minify
    });

    // The inline sourceMaps are not good, so we inline it ourselves.
    if (fileName) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sourceMap = JSON.parse((ret as any).map);
      sourceMap.sources[0] = fileName;
      return ret.code + `\n//# sourceMappingURL=data:application/json;base64,${btoa(JSON.stringify(sourceMap))}`;
    }

    return ret.code;
  };
}