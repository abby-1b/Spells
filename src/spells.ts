import { startServer } from "./server.ts"
import { compile, compileTS, startTSServer } from "./compile.ts"
import { logStyle, warning } from "./logging.ts"

import { update } from "../install/upgrade.ts"
import { remove } from "../install/remove.ts"
import { InstallMethod } from "../install/base.ts"

/**
 * The compiler version (1st) changes when there's any API breaking changes.
 * The 'build' number (2nd) changes whenever anything new is added.
 */
export const VERSION = "0.6"

const COMMANDS: { [key: string]: string[] } = {
	"help, h, (empty)": [ "Shows this dialogue" ],
	"version, v": [ "Shows the version number" ],

	"server, serve, s  [port] [--bind] [--silent]": [
		"Starts a server, accepting an optional argument for the port.",
		"The default port is :8080",
		"bind: sets the address that we're outputting to.",
		"silent: stops the server from emitting messages"
	],

	"build, b  buildDir  outDir [--final]": [
		"Builds the site to vanilla HTML and JS.",
		"final: minifies before exporting, removing source maps and minifying variable names."
	],

	"upgrade, u": [
		"Upgrades spl to the latest version."
	],

	"remove, rm, r": [
		"Deletes spl"
	]
}

/** The passed arguments. */
const args = [...Deno.args]
const installMode = args.shift()! as InstallMethod

async function getFiles(path: string) {
	if (!path.endsWith("/")) path += "/"
	const ret: string[] = []
	for (const f of Deno.readDirSync(path)) {
		if (f.isFile) {
			ret.push(path + f.name)
		} else {
			ret.push(path + f.name)
			ret.push(...await getFiles(path + f.name))
		}
	}
	return ret
}

if (args.length == 0 || args[0][0] == "h") {
	// Help
	logStyle("font-weight: bold", "Spells v" + VERSION)
	console.log("\nCommands:")
	for (const c in COMMANDS) {
		logStyle("color: blue; font-weight: bold", "    " + c)
		for (const l of COMMANDS[c]) {
			logStyle(l.startsWith("--") ? "color: yellow" : "", "        " + l)
		}
		console.log()
	}
	Deno.exit()
} else if (args[0][0] == "v") {
	logStyle("font-weight: bold", "Spells v" + VERSION)
	Deno.exit()
} else if (args[0][0] == "s") {
	// Server
	const port = args.length > 1 ? parseInt(args[2]) : 8080
	startServer({
		port
	})
	// TODO: acknowledge --bind and --silent
} else if (args[0][0] == "b") {
	// Build
	if (args.length < 3) {
		warning("Please provide an input and output directory.")
	} else {
		const buildDir = args[1]
			, outDir = args[2]
			, final = args.length > 3 ? args.includes("final") : false
		
		// Get the files
		const buildFiles = await getFiles(buildDir)
		if (buildFiles.map(e => e.endsWith(".ts")).includes(true))
			await startTSServer()

		// Remove the output directory (if it exists)
		try { await Deno.remove(outDir, { recursive: true }) } catch { 0 }
		await Deno.mkdir(outDir)

		// One by one, output the files. Compile them is necessary.
		for (const from of buildFiles) {
			const to = outDir + "/" + from.split("/").slice(1).join("/")
			if (!to.includes(".")) {
				// Make a directory
				await Deno.mkdir(to)
			} else if (to.endsWith(".spl")) {
				// Compile .spl files
				const d = await Deno.readTextFile(from)
				await Deno.writeTextFile(to.replace(/\.spl$/, ".html"), compile(d, { convertJStoTS: true }))
			} else if (to.endsWith(".ts")) {
				// Compile .ts files
				const d = await Deno.readTextFile(from)
				await Deno.writeTextFile(to.replace(/\.ts$/, ".js"), compileTS(d, final ? undefined : from.split("/").slice(-1)[0], final))
			} else {
				// Else, just copy the file
				Deno.copyFile(from, to)
			}
		}
	}
} else if (args[0][0] == "u") {
	await update(installMode, VERSION)
} else if (args[0][0] == "r") {
	await remove(installMode)
}
