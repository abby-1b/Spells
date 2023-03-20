import { startServer } from "./server.ts"
import { compile } from "./compile.ts"
import { logStyle, warning } from "./logging.ts"

/** The compiler version, which changes when there's any API breaking changes. */
const VERSION = "0.0"

const COMMANDS: { [key: string]: string[] } = {
	"help, h": [ "Shows this dialogue" ],
	"server, serve, s  [port]": [
		"Starts a server, accepting an optional argument for the port.",
		"The default port is :8080"
	],
	"build, b": [ "Builds the app" ]
}

const args = (Deno.args ?? []).map(a => a.replace(/^-{1,}/g, ""))

if (args.length == 0 || args[0][0] == "h") {
	// Help
	logStyle("font-weight: bold", "Spells v" + VERSION)
	console.log("\nCommands:")
	for (const c in COMMANDS) {
		logStyle("color: blue; font-weight: bold", "    " + c)
		logStyle("", "        " + COMMANDS[c].join("\n        ") + "\n")
	}
	Deno.exit()
} else if (args[0][0] == "s") {
	// Server
	const port = args.length > 1 ? parseInt(args[2]) : 8080
	startServer(port)
} else if (args[0][0] == "b") {
	// Build
	if (args.length == 1)
		warning("No file provided, defaulting to index.spl")
	const files: string[] = 
		args.length > 1
			? args.slice(1)
			: ["index.spl"]
	for (const f of files) {
		if (!f.endsWith(".spl")) {
			console.warn(`Can't compile non-.spl file: ${f}`)
			continue
		}
		const code = Deno.readTextFileSync(f)
		const compiled = compile(code)
		Deno.writeTextFileSync(f.replace(/\.spl$/g, ".html"), compiled)
	}
}
