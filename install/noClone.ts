/**
 * Adds `spl` to the PATH, installing everything in `~/.spl`
 */

import { install, showError, installURL, installDirPath } from "./base.ts"

try {
	// Remove the install directory if it exists
	// This has its own try-catch because it can fail with no issue
	try {
		await Deno.remove(installDirPath, { recursive: true })
	} catch { 0 }

	// Make the install directory
	await Deno.mkdir(installDirPath, { recursive: true })

	const dirs: Record<string, string[]> = await fetch(
		installURL + "srcFiles.json"
	).then(r => r.json())
	
	for (const p in dirs) {
		await Deno.mkdir(installDirPath + p, { recursive: true })
		for (const f of dirs[p]) {
			// console.log("Make:", f, "in", p)
			await fetch(installURL + p + "/" + f).then(r => r.text())
				.then(t => Deno.writeTextFile(installDirPath + p + "/" + f, t))
		}
	}

	// Install!
	install(installDirPath, "noclone")
} catch (e) {
	showError(e)
}
