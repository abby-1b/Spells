// deno-lint-ignore-file no-explicit-any

// This is here exclusively because I LOVE colored error/warning messages.
// Can't live without 'em. I thought this would be a great place to use Deno's
// built-in CSS syntax for highlighting, just like in the browser!

/** Logs an error to the console (in red) and exits the program. */
export function error(...args: any[]) {
	errorNoExit(...args)
	Deno.exit(1)
}

/** Logs an error to the console (in red) without exiting the program. */
export function errorNoExit(...args: any[]) {
	console.log(
		"%c" + args.map(e =>
			typeof e === "string" ? e : JSON.stringify(e)
		).join(" ") + "\n"
		+ new Error().stack!
			.split("\n").slice(2).join("\n"),
		"color: red"
	)
}

/** Logs a warning to the console (in yellow). Doesn't exit the program. */
export function warning(...args: any[]) {
	console.log(
		"%c" + args.map(e =>
			typeof e === "string" ? e : JSON.stringify(e)
		).join(" "),
		"color: yellow"
	)
}

export function logColor(color: string, ...args: any[]) {
	console.log(
		"%c" + args.map(e =>
			typeof e === "string" ? e : JSON.stringify(e)
		).join(" "),
		"color: " + color
	)
}

export function logStyle(style: string, ...args: any[]) {
	console.log(
		"%c" + args.map(e =>
			typeof e === "string" ? e : JSON.stringify(e)
		).join(" "),
		style
	)
}
