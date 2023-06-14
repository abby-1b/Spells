/**
 * Adds `spl` to the PATH, linked to this directory.
 */

import { install } from "./base.ts"

/** The path to the Spells source files */
const splPath = new URL('.', import.meta.url).pathname
	.split("/").slice(0, -2).join("/") + "/"

// Warn the user
console.log(
	"This will make `spl` point to this directory.\n" +
	"If you move this directory elsewhere, you'll have to run this command again.\n"
)

// Install!
install(splPath, "clone")
