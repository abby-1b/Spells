
const cwd = new URL('.', import.meta.url).pathname

const file = `deno run -A ${cwd}src/spells.ts "$@"`

try {
	Deno.writeTextFileSync("/usr/local/bin/spl", file)
	Deno.run({ cmd: ["chmod", "+x", "/usr/local/bin/spl"] })
} catch {
	console.log("Please run the installer with sudo.")
}
