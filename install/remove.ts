import { InstallMethod, installDirPath, locationFile, tryElseErrSudo } from "./base.ts"

export async function remove(installMode: InstallMethod) {
	let removeDir = true
	if (installMode == "clone") {
		// Print the little clone dialog
		const splFile = new URL(import.meta.url).pathname.split("/")
		splFile.pop(), splFile.pop()
		console.log(
			"Spells was installed by %ccloning the GitHub repository%c, so " +
			"it will only be\nremoved from the %c$PATH%c. To uninstall it " +
			`completely, run:\n  %crm -r ${splFile.join("/")}/`,
			"color: green", "color: unset",
			"color: yellow", "color: unset",
			"color: yellow"
		)

		removeDir = false
	}

	// Ask the user, to prevent unwanted removal
	if ((prompt("Are you sure you want to uninstall Spells? [yes/y]") ?? "n")[0] != "y") {
		console.log("\nCanceled.")
		Deno.exit()
		return
	}

	await tryElseErrSudo(async () => {
		// Remove the `spl` command
		await Deno.remove(locationFile)
		
		// Remove the directory
		if (removeDir) {
			await Deno.remove(installDirPath, { recursive: true })
		}
	})
	
	console.log("Spells has been uninstalled.")
	Deno.exit()
}
