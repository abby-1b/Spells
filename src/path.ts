export function pathGoUp(path: string) {
	const endsWithSlash = path.endsWith("/")
	if (endsWithSlash) {
		return path.split("/").slice(0, -2).join("/")
	} else {
		return path.split("/").slice(0, -1).join("/") + "/"
	}
}

// These are here for future compatibility!

export function readTextFile(path: string) {
	return Deno.readTextFile(path)
}

export function readTextFileSync(path: string) {
	return Deno.readTextFileSync(path)
}
