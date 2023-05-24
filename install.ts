
const cwd = new URL('.', import.meta.url).pathname

const file = `deno run -A ${cwd}src/spells.ts "$@"`

const location = "/usr/local/bin/spl"

try {
	try {
		// Try to install
		await Deno.writeTextFile(location, file)
	} catch {
		// Apparently, sometimes `/usr/local/bin` doesn't exist???
		// So make it.
		await Deno.mkdir("/usr/local/bin")

		// Then try to install.
		await Deno.writeTextFile(location, file)
	}

	// await Deno.run({ cmd: ["chmod", "+x", "/usr/local/bin/spl"] }).status()
	await new Deno.Command(Deno.execPath(), {
		args: ["chmod", "+x", "/usr/local/bin/spl"]
	}).output()

} catch {
	// We're just gonna assume that the user didn't use `sudo`.
	console.log("Please run this command with sudo.")
}

// TODO: install the VSCode extension automatically.
// (or maybe just add it to the extension shop)
