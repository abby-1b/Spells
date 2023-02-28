import { startServer } from "./server.ts"
import { compile } from "./compile.ts"
import { logColor } from "./logging.ts"

const HELP_STRING = `
Spells: An amalgamation

THINGS:

	help, h
		Shows this dialogue

	server, serve, s
		Starts a server, accepting an optional argument for the port.
		The default port is :8080

	build, b
		Builds the app 
`.replace(/\t/g, "    ")

const args = (Deno.args ?? []).map(a => a.replace(/^-{1,}/g, ""))

if (args.length == 0 || args[0][0] == "h") {
	// Help
	console.log(HELP_STRING)
	Deno.exit()
} else if (args[0][0] == "s") {
	// Server
	const port = args.length > 1 ? parseInt(args[2]) : 8080
	startServer(port)
} else if (args[0][0] == "b") {
	// Build
	const files: string[] = 
		args.length > 1
			? args.slice(1)
			: ["index.pug"]
	for (const f of files) {
		if (!f.endsWith(".pug")) {
			console.warn(`Can't compile non-.pug file: ${f}`)
			continue
		}
		const code = Deno.readTextFileSync(f)
		const compiled = compile(code)
		Deno.writeTextFileSync(f.replace(/\.pug$/g, ".html"), compiled)
	}
}
