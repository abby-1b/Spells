import { InstallMethod, tryElseErrSudo } from "../install/base.ts";
import { VERSION } from "../src/spells.ts";
import { remove } from "./remove.ts";

export async function update(installType: InstallMethod, currVersion: string) {
	if (installType == "clone") {
		console.log(
			"%cSpells was installed by %ccloning the GitHub repository%c, which " +
			"isn't supported for\nupgrading right now.",
			"color: red",
			"color: yellow",
			"color: red"
		)
		Deno.exit(1)
	}
	const remote = await (await import("../install/base.ts")).compareRemote(currVersion)
	if (remote[1]) {
		console.log(
			`Upgrading %c${currVersion} %c-> %c${remote[0]}%c...`,
			"color: yellow", "color: unset", "color: green", "color: unset"
		)

		// Remove the current install
		remove(installType, false)

		// Re-install
		await tryElseErrSudo(async () => {
			await new Deno.Command("deno", { args: [
				"run", "-A",
				"https://raw.githubusercontent.com/abby-1b/Spells/main/install/noClone.ts"
			] }).output()
		})
	} else {
		console.log(`%cSpells is up to date. (v${VERSION})`, "color: green")
	}
}
