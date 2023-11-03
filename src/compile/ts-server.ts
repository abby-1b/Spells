
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
	await startTSServer()
	return compileTS(source, fileName, minify)
}

let startedTSServer = 0 // 0: not started, 1: starting, 2: started
/** Starts the TypeScript compilation server */
export async function startTSServer() {
	// If it's already started, return immediately
	if (startedTSServer == 2) return
	if (startedTSServer == 1) {
		// If it's starting, wait for it to be initialized fully
		const wait = () => new Promise(resolve => setTimeout(resolve, 500))
		while (startedTSServer == 1) await wait()
		return
	}

	// If this is the first time we're starting it, let the others know
	startedTSServer = 1
	const innerTransform =
		(await import("https://deno.land/x/swc@0.2.1/mod.ts")).transform
	startedTSServer = 2
	console.log("TypeScript compiler loaded!")
	
	// deno-lint-ignore require-await
	compileTS = async (
		source: string,
		fileName?: string,
		minify?: boolean
	): Promise<string> => {
		const ret = innerTransform(source, {
			jsc: {
				target: "es2022",
				parser: {
					syntax: "typescript",
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
		})

		// The inline sourceMaps are not good, so we inline it ourselves.
		if (fileName) {
			// deno-lint-ignore no-explicit-any
			const sourceMap = JSON.parse((ret as any).map)
			sourceMap.sources[0] = fileName
			return ret.code + `\n//# sourceMappingURL=data:application/json;base64,${btoa(JSON.stringify(sourceMap))}`
		}

		return ret.code
	}
}