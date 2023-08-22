// Packing For Web!

// Some Spells features need to be packed for the web. This is a fact of life.
// However, sometimes they're also a part of the main source, as is the case of
// the `highlighting.ts` file. Because of this, we need something to pack these
// features into a single JS package that can be included along with the code.
// This is all hard-coded, so changes to the API will result in breaking here.
// Be careful, and good luck.

export async function pack(fileName: string) {
	await new Deno.Command("deno", {
		args: [ "bundle", "-q", fileName, ".temp.js" ]
	}).output()
	const txt = await Deno.readTextFile(".temp.js")
	await Deno.remove(".temp.js")
	return txt
}

console.log(await pack("src/highlight.ts"))
