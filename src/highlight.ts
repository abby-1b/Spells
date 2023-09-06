import { Element, parse } from "./compile/parse.ts"
import { errorNoExit } from "./logging.ts"
import { readTextFileSync } from "./path.ts"

const enum COLOR {
	TAG = "#b4fdfe",
	ATTR_SEPARATOR = "#f3d246",
	ATTR_KEY = "#a1fcc0",
	ATTR_STRING = "#abf989",
	CLASS = "#f1a239",
	ID = "#f1a239",
	MULTILINE = "#f1a239",
}

const OUT_TAB = "&nbsp;&nbsp;&nbsp;&nbsp;"
function colorize(txt: string, color: COLOR) {
	return `<col style="color:${color}">${
		txt
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#39;")
	}</col>`
}

/**
 * Generates syntax highlighting (in HTML form) for a set of elements
 * @param elements The array of elements
 * @param indent The indent level. This is used in recursion and isn't required.
 * @returns 
 */
function genHighlights(elements: Element[], indent = 0): string {
	const tabs = OUT_TAB.repeat(indent)
	let out = tabs
	for (const e of elements) {
		out += colorize(e.tagName, COLOR.TAG)
		if (e.attrs && Object.keys(e.attrs).length != 0) {
			out += colorize("(", COLOR.ATTR_SEPARATOR)
			for (const a in e.attrs) out +=
				colorize(a, COLOR.ATTR_KEY) +
				colorize("=", COLOR.ATTR_SEPARATOR) + 
				colorize(e.attrs[a], COLOR.ATTR_STRING)
			out += colorize(")", COLOR.ATTR_SEPARATOR)
		}
		if (e.clss && e.clss.length > 0)
			out += colorize(e.clss.map(e => `.${e}`).join(""), COLOR.CLASS)
		if (e.id)
			out += colorize("#" + e.id, COLOR.ID)

		if (e.multiline)
			out += colorize(".", COLOR.MULTILINE)
		if (e.innerText)
			out += (e.multiline ? `\n` : " ") + 
				e.innerText.replace(/\t/g, OUT_TAB)
		if (e.children && e.children.length > 0)
			out += `\n${tabs}` + genHighlights(e.children, indent + 1)
		out += `\n${tabs}`
	}
	return out
}

/**
 * Applies syntax highlighting to Spells code.
 * @param code 
 * @param options 
 */
export function syntaxHighlight(code: string): string {
	try {
		const parsed = parse(code, {
			filePath: "./"
		})[0]
		return genHighlights(parsed)
	} catch (e) {
		errorNoExit("Tried highlighting:\n" + code)
		console.log(e)
		return ""
	}
}

// Run a simple test if this is ran standalone
if (import.meta.main) {
	const path = "test/index.spl"
	const f = readTextFileSync(path)
	const out = syntaxHighlight(f)
	console.log(out.replace(/&nbsp;/g, " "))
}
