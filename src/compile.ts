import { error, errorNoExit } from "./logging.ts"
import { markDownToHtml } from "./mdc.ts"

// This is here to at least throw *something* before the real SWC transformer
// is loaded. Sure, it'll likely error on the output file, but in the
// off-chance that the user really wrote normal JavaScript, i'll take it.
export let transform = (source: string): string => source
;(async () => {
	const innerTransform = (await import("https://deno.land/x/swc@0.2.1/mod.ts")).transform
	transform = (source: string) =>
		innerTransform(source, {
			jsc: { parser: { syntax: "typescript", tsx: true } }
		}).code
})()

/** Tags that we won't apply MarkDown to */
const noMarkDownTags = [
	"style",
	"css",
	"script"
]

/** A virtual element structure */
interface Element {
	tagName: string
	attrs?: { [key: string]: string }
	clss?: string[]
	id?: string
	innerText?: string
	children?: Element[]
	singleTag?: boolean
	notMarkDown?: boolean
}

/**
 * Converts a character index to the corresponding line and column in the
 * source string.
 */
function idxToPos(src: string, idx: number): string {
	const matches = [...src.matchAll(/\n/g)]
		, lineNum = matches.findIndex(m => m.index! > idx) ?? 0
		, colNum = idx - matches[lineNum - 1].index!
	return lineNum + ":" + colNum
}

/** Characters that can be used inside a tag name. */
const nameChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXZY0123456789_-"

/**
 * Parses a string into an element structure.
 * @param code The code we're parsing 
 * @returns The element structure and the last character that it parsed
 */
function parse(code: string, indent = 0, startI = 0): [Element[], number] {
	code += "\n"
	const els: Element[] = []
	let tagIndent = 0, tagName = "", i = startI
	for (; i < code.length; i++) {
		const c = code[i]
		if (nameChars.includes(c)) {
			tagName += code[i]
			continue
		}
		if (c == "\t") tagIndent++
		if (tagName.length == 0) continue
		if (tagIndent < indent) {
			i -= tagName.length + 2
			break
		}

		// Get the things that are a part of the tag: class,
		// ID, and attributes. (+ the multi-line operator)
		let j = i, nest = 0
		while (true) {
			if ((code[j] == "\n" || code[j] == " ") && nest == 0) break
			if (code[j] == "(" || code[j] == "[" || code[j] == "{") nest++
			else if (code[j] == ")" || code[j] == "]" || code[j] == "}") nest--
			if (++j > code.length) error("Un-matched nest:", idxToPos(code, i))
		}
		const thingsString = code.slice(i, j); i = j
		const things = thingsString
			.trim().split(/(?<=.)(?=#|\(|\.)(?![^(]*\))/g)

		// Get the attributes
		const attrs: { [key: string]: string } = {}
		things.filter(t => t[0] == "(").forEach(a => {
			a.slice(1, -1).split(",").forEach(n => {
				const s = n.split("=")
				attrs[s[0].trim()] = s[1]?.trim()
			})
		})

		// Get innerText / children
		const children: Element[] = []
		let innerText: string | undefined
		if (things[things.length - 1] == ".") {
			const endIndex = [...code.matchAll(
				new RegExp(`^\t{0,${indent}}(?!\t)`, "gm")
			)].find(m => m.index! >= i)!.index! - 1
			innerText = code
				.slice(i + 1, endIndex)
			i = endIndex
		} else {
			// If the string isn't multiline, it could still have some text!
			const until = code.indexOf("\n", i)
			innerText = code.slice(i + 1, until)
			i = until

			// If it's not multline, it can always have children!
			const [elements, finishI] = parse(code, indent + 1, i)
			children.push(...elements)
			i = finishI
		}

		// Finally, push the element!
		els.push({
			tagName, attrs,
			clss: things.filter(t => t[0] == "." && t.length > 1).map(c => c.slice(1)),
			id: things.filter(t => t[0] == "#")[0]?.slice(1),
			innerText, children,
			notMarkDown: noMarkDownTags.includes(tagName)
		} as Element), tagName = "", tagIndent = 0
	}
	return [els, i]
}

/**
 * Converts elements to their HTML representation.
 * @param els The element structure
 * @param indent The current level of indentation
 * @returns The generated string of HTML code
 */
function gen(els: Element[], indent = 0): string {
	let out = "", i = 0
	for (const e of els) {
		out += (i++ == 0 ? "<" : "\n<") + e.tagName // Tag beginning

		// Append attributes
		if (e.attrs && Object.keys(e.attrs).length > 0)
			out += " " + Object.entries(e.attrs)
				.map(n => n[0] + (n[1] ? "=" + n[1] : ""))
				.join(" ")

		// Append id & class
		if (e.id) out += ` id="${e.id}"`
		if (e.clss && e.clss.length > 0) out += ` class="${e.clss.join(" ")}"`
		out += ">" // Close the opening tag

		// Append innerText and children (recursively)
		const isTooLong = (e.innerText ?? "").length > 70
		if (e.innerText && e.innerText.length > 0)
			out += e.notMarkDown
				? e.innerText
				: (isTooLong ? "\n\t" : "")
				+ markDownToHtml(e.innerText)
				+ (isTooLong ? "\n" : "")
		if (e.children && e.children.length > 0)
			out += "\n\t" + gen(e.children, indent + 1)
				.split("\n").join("\n\t")
				+ "\n"

		// Append closing tag
		if (
			(e.innerText && e.innerText.length > 0) ||
			(e.children && e.children.length > 0) ||
			!e.singleTag
		) out += `</${e.tagName}>`
	}
	return out
}

/**
 * Crawls through the modified element tree, modifying things here and there.
 * Keep in mind this is depth-first, so things are parsed in the order they
 * appear in the oringal file (so sections can't be used before they're
 * declared). This function modifies the element structure in place.
 * @param els The element structure we're crawling through
 */
function crawl(els: Element[], components: Record<string, Element>): string[] {
	const foundTSSources: string[] = []
	for (let e = 0; e < els.length; e++) {
		const el = els[e]
		if (el.attrs && "@" in el.attrs) {
			// Is a component!
			if (!(el.tagName in components)) {
				// It's a new component!
				components[el.tagName] = el // Add component to the dict
				delete el.attrs["@"] // Delete the component-identifying attr
				el.tagName = "div" // Set the component to be a `div` (default)
				els.splice(e--, 1) // Remove the component from the main tree
				continue
			}

			// It's an instance of an already-existing component!
			const c = components[el.tagName]
			const nel: Element = {
				tagName: c.tagName,
				attrs: { ...c.attrs },
				clss: [...c.clss ?? []],
				id: c.id,
				innerText: c.innerText,
				children: [...c.children ?? [], ...el.children ?? []],
				singleTag: c.singleTag
			}
			foundTSSources.push(...crawl(nel.children!, components))
			els[e] = nel
			continue
		} else if (el.tagName == "style") {
			if (el.attrs && "src" in el.attrs) {
				el.tagName = "link"
				el.attrs = { rel: '"stylesheet"', href: el.attrs.src }
			}
		} else if (el.tagName == "script") {
			if (el.attrs && "src" in el.attrs) {
				foundTSSources.push(el.attrs.src)
			} else if (el.innerText) {
				el.innerText = transform(el.innerText)
			}
		}
		// TODO: repeatable components across multiple files
		// TODO: parse a few attributes into CSS

		if (el.children) foundTSSources.push(...crawl(el.children, components))
	}
	return foundTSSources
}

/**
 * Modifies the element structure, making sure it's properly formatted
 * according to a pretty loose HTML code style, which is more or less what
 * appears after code is parsed by most modern browsers.
 * @param els The element structure we're modifying
 * @returns 
 */
function modify(els: Element[]) {
	const hasTag = (el: Element, searchTag: string): boolean =>
		el.children ? !!el.children.find(e => e.tagName == searchTag) : false

	let htmlTag: Element, headTag: Element
	const topTags = els.map(e => e.tagName)
	if (!topTags.includes("html")) {
		// Add <html> around everything
		els = [htmlTag = {
			tagName: "html",
			children: els
		} as Element]
	} else htmlTag = els[topTags.indexOf("html")]
	if (!hasTag(htmlTag, "body")) {
		// Add <body> around everything after <head>
		const headIdx = htmlTag.children!.findIndex(c => c.tagName == "head")
		if (headIdx == -1) {
			// Get the head element
			headTag = { tagName: "head", children: [] }
			htmlTag.children?.unshift(headTag)
		} else
			headTag = htmlTag.children![headIdx]
		const bodyEls = htmlTag.children!.splice(headIdx + 1)
		htmlTag.children!.push({
			tagName: "body",
			children: bodyEls
		} as Element)
	} else {
		// Just the head element
		if (hasTag(htmlTag, "head"))
			headTag = htmlTag.children!.find(t => t.tagName == "head")!
		else {
			headTag = { tagName: "head", children: [] }
			htmlTag.children?.unshift(headTag)
		}
	}

	headTag.children!.push({
		tagName: "style",
		innerText: Deno.readTextFileSync("./css/basic.css"),
		notMarkDown: true
	} as Element)

	const foundTSSources = crawl(els, {})
	// Add <!DOCTYPE html> at the beginning of the document
	els.unshift({
		tagName: "!DOCTYPE html",
		singleTag: true
	} as Element)
	return {
		els,
		foundTSSources
	}
}

/**
 * Compiles a string of Spell code.
 * @param code The code
 * @returns The compiled code
 */
export function compile(code: string): string {
	try {
		const parsed = parse(code)[0]
		const { els } = modify(parsed)
		return gen(els)
	} catch (e) {
		errorNoExit(e, false)
		return ""
	}
}

// Run a simple test if the compile function is ran standalone.
if (import.meta.main) {
	const f = Deno.readTextFileSync("index.pug")
	const out = compile(f)
	console.log(out)
}
