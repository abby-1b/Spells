
/** The install directory of `spl` */
export const locationDir = "/usr/local/bin/"

/** The path to `spl` */
export const locationFile = locationDir + "spl"

/** The install path for the source files */
export const installDirPath = Deno.env.get("HOME") + "/.spl/"

/** The install URL */
export const installURL = "https://raw.githubusercontent.com/CodeIGuess/Spells/main/"

const shellCodeBase = `#!/usr/bin/env bash\ndeno run -A &1src/spells.ts &2 "$@"`

export type InstallMethod = "clone" | "noclone"
export async function install(srcLocation: string, method: InstallMethod) {
	// Generate the `spl` file
	const shellCode = shellCodeBase
		.replace("&1", srcLocation)
		.replace("&2", method) // Pass the method of install

	try {
		// Make the install directory (if it exists this won't do anything!)
		await new Deno.Command("mkdir", {
			args: [ "-p", locationDir ]
		}).output()

		// Write the file
		await Deno.writeTextFile(
			locationFile,
			shellCode
		)

		// Make the command runnable!
		await new Deno.Command("chmod", {
			args: ["+x", locationFile]
		}).output()

		console.log("%cSpells successfully installed!", "color: green")
	} catch (e) {
		showError(e)
	}
}

export async function tryElseErrSudo<T>(f: () => Promise<T>): Promise<T | undefined> {
	try {
		return await f()
	} catch (e) {
		showError(e)
	}
}

export function showError(e: Error) {
	if (e instanceof Deno.errors.PermissionDenied) {
		// The user didn't use sudo!
		console.log("%cPlease run this with sudo.", "color: red")
		Deno.exit(1)
	} else {
		console.log(
			"%cAn error happened on our end. Please open an issue on:\n" +
			"https://github.com/CodeIGuess/Spells/issues/new", "color: red"
		)
		throw e
	}
}

export async function compareRemote(currVersion: string): Promise<[string, boolean]> {
	// Get the remote version number
	const t = await fetch(installURL + "/src/spells.ts").then(r => r.text())
	let remoteVersion = t.slice(t.indexOf("VERSION") + 11)
	remoteVersion = remoteVersion.slice(0, remoteVersion.indexOf('"'))

	// Convert the versions into floats to compare them
	const currArr = currVersion.split(".")
		.map((e, i) => parseInt(e) / 1000 ** i)
		.reduce((a, b) => a + b)
	const remoteArr = remoteVersion.split(".")
		.map((e, i) => parseInt(e) / 1000 ** i)
		.reduce((a, b) => a + b)
	// Yes, I know this is a VERY bad thing to do, as floating point precision
	// could be an issue; HOWEVER, hear me out: it's good enough.
		
	return [remoteVersion, remoteArr > currArr]
}
