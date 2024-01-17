import { CompileOptions } from "./compile-options.ts"

import { error, errorNoExit } from "../logging.ts"
import { pathGoUp, readTextFile } from "../path.ts"

import { markDownToHtml } from "./mdc.ts"
import { Element, parse } from "./parse.ts"
import { tagHead } from "./special-tags.ts"
import { compileTS } from "./ts-server.ts"

const acceptedImportTags = [
	"@import",
	"@imports",
	"@require",
	"@requires",
	"@include",
	"@includes",
	"@need",
	"@needs",
	"@want",
	"@wants",
	"@desire",
	"@desires",
	"@necessitate",
	"@necessitates",
	"@steal-code-from",
	"@steals-code-from",
]

/**
 * Takes care of extra features like import, components, and TypeScript inside
 * of script tags. Modifies the element structure IN PLACE and depth-first!
 * @param els The element structure we're crawling through
 * @param components Components that have been initiated so far
 * @param isHead Whether or not we're crawling inside the "head" tag
 * @param compileOptions The compile options
 * @returns The TypeScript sources found in the tree, along with elements that
 * belong in the `head` of the document.
 */
async function crawl(
	els: Element[],
	components: Record<string, Element>,
	isHead: boolean,
	compileOptions: CompileOptions
): Promise<{
	tsSources: string[],
	headElements: Element[]
}> {
	const tsSources: string[] = []
	const headElements: Element[] = []
	for (let e = 0; e < els.length; e++) {
		const el = els[e]
		if (acceptedImportTags.includes(el.tagName)) {
			// We're importing another `.spl` file!

			/*
			 * TODO: import HTML too! This would, however, require parsing the
			 * HTML into an element tree manually, which could be complicated...
			 */

			if (!el.innerText) error("Please provide a file to import")
			const finalPath = pathGoUp(el.file) + "/" + el.innerText!
			const code = await readTextFile(finalPath)
			const parsed = parse(code, {
				convertExtensionTStoJS: compileOptions.convertExtensionTStoJS,
				filePath: finalPath,
				mapPaths: compileOptions.mapPaths ?? compileOptions.filePath
			})[0]
			els.splice(e, 1, ...parsed)
			e--
			continue
		}
		if (el.tagName == "css") el.tagName = "style"
		if (el.attrs && "@" in el.attrs) {
			// This is a component!

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
				file: c.file,
				attrs: { ...c.attrs, ...el.attrs },
				clss: [el.tagName, ...el.clss ?? [], ...c.clss ?? []],
				id: c.id,
				innerText: c.innerText,
				children: [...c.children ?? [], ...el.children ?? []],
				singleTag: c.singleTag,
				multiline: c.multiline
			}
			const crawlResults = await crawl(
				nel.children!,
				components,
				false,
				compileOptions
			)
			tsSources.push(...crawlResults.tsSources)
			headElements.push(...crawlResults.headElements)
			els[e] = nel
			continue
		} else if (el.tagName == "style") {
			if (el.attrs && "src" in el.attrs) {
				el.tagName = "link"
				el.attrs = { rel: '"stylesheet"', href: el.attrs.src }
			}
		} else if (el.tagName == "script") {
			if (el.attrs && "src" in el.attrs) {
				if (compileOptions.convertExtensionTStoJS) {
					// Replace .ts with .js
					if (el.attrs.src.endsWith(".ts"))
						el.attrs.src = el.attrs.src.slice(0, -2) + "js"
					else if (el.attrs.src.endsWith(".ts\""))
						el.attrs.src = el.attrs.src.slice(0, -3) + "js\""
				}
				tsSources.push(el.attrs.src)
			} else if (el.innerText) {
				el.innerText = await compileTS(el.innerText)
			}
		}

		// TODO: parse a few attributes into CSS (maybe? maybe not?)

		// Crawl through the children
		if (el.children) {
			const crawlResults =
				await crawl(el.children, components, false, compileOptions)
			tsSources.push(...crawlResults.tsSources)
			headElements.push(...crawlResults.headElements)
		}

		// Move into the head tag
		if (!isHead && tagHead.includes(el.tagName)) {
			headElements.push(el)
			els.splice(e--, 1)
			continue
		}
	}
	return {
		tsSources,
		headElements
	}
}

/**
 * Modifies the element structure, making sure it's properly formatted
 * according to a pretty loose HTML code style, which is more or less what
 * appears after code is parsed by most modern browsers. NOTE: This calls
 * `crawl`!
 * @param els The element structure we're modifying
 * @returns An object with the elements in order, and a list of the TypeScript
 * sources found within the structure
 */
// let headTag: Element
export async function modify(
	els: Element[],
	compileOptions: CompileOptions
): Promise<{
	els: Element[],
	tsSources: string[]
}> {
	/**
	 * Checks if a tag exists in the children of an element. The tag has to be a
	 * direct child of the searched element, so a tag that is nested within
	 * another element will not be counted!
	 * @param el The element to be searched
	 * @param searchTag The name of the tag to search (eg. "div", "head", etc.)
	 * @returns Whether or not the tag exists within the element
	 */
	const hasTag = (el: Element, searchTag: string): boolean =>
		el.children ? !!el.children.find(e => e.tagName == searchTag) : false

	let htmlTag: Element
	let headTag = undefined as unknown as Element
	const topTags = els.map(e => e.tagName)
	if (!topTags.includes("html")) {
		// Add <html> around everything
		htmlTag = {
			tagName: "html",
			children: els,
			file: compileOptions.filePath
		}
		els = [ htmlTag ]
	} else {
		htmlTag = els[topTags.indexOf("html")]
	}

	if (!hasTag(htmlTag, "body")) {
		// Add <body> around everything after <head>
		const headIdx = htmlTag.children!.findIndex(c => c.tagName == "head")
		if (headIdx == -1) {
			// If the `head` element doesn't exist, make it
			headTag = {
				tagName: "head",
				file: compileOptions.filePath,
				children: []
			}
		} else {
			// If `head` DOES exist, get it
			headTag = htmlTag.children![headIdx]
			htmlTag.children!.splice(headIdx, 1)
		}
		htmlTag.children = [{
			tagName: "body",
			file: compileOptions.filePath,
			children: htmlTag.children!
		}]
	} else {
		// Just the head element
		if (hasTag(htmlTag, "head")) {
			headTag = htmlTag.children!.find(t => t.tagName == "head")!
		} else {
			headTag = {
				tagName: "head",
				file: compileOptions.filePath,
				children: []
			}
			htmlTag.children?.unshift(headTag)
		}
	}

	// Add the base meta tag for mobile devices:
	// <meta name="viewport" content="width=device-width, initial-scale=1.0">
	headTag.children!.push({
		tagName: "meta",
		file: compileOptions.filePath,
		attrs: {
			name: '"viewport"',
			content: '"width=device-width,initial-scale=1.0"'
		}
	})

	const components = {}
	crawl(headTag.children ?? [], components, true, compileOptions)

	const crawlResults = await crawl(els, {}, false, compileOptions)
	headTag.children!.push(...crawlResults.headElements)

	// If the head tag isn't already in the HTML, add it!
	if (!hasTag(htmlTag, "head")) {
		htmlTag.children!.unshift(headTag)
	}

	// Add <!DOCTYPE html> at the beginning of the document
	els.unshift({
		tagName: "!DOCTYPE html",
		singleTag: true,
		file: compileOptions.filePath
	})

	return {
		els,
		tsSources: crawlResults.tsSources
	}
}

/**
 * Replaces variables in a string
 * @param inputString The string to replace variables in. Note that variables
 * are declared as `@{varName}`
 * @param varDict The variables as `"varName": varValue` pairs
 * @returns The string, with each reference to a variable replaced by said
 * variable's value
 */
function replaceVariables(
	inputString: string,
	varDict: Record<string, string>
): string {
	const ret = inputString.replace(/@{[a-zA-Z0-9_\-@]*?}/g, e => {
		const varName = e.slice(2, -1)
		if (!(varName in varDict)) return e
		let out = varDict[varName]
		if (out.startsWith('"') || out.startsWith("'")) out = out.slice(1, -1)
		return out
	})
	return ret
}

/**
 * Converts elements to their HTML representation.
 * @param els The element structure
 * @param indent The current level of indentation
 * @returns The generated string of HTML code
 */
async function gen(
	els: Element[],
	indent = 0,
	variables: Record<string, string>
): Promise<string> {
	let out = "", i = 0
	for (const e of els) {
		out += (i++ == 0 ? "<" : "\n<") + e.tagName // Tag beginning

		// Append attributes
		if (e.attrs && Object.keys(e.attrs).length > 0) {
			for (const attr in e.attrs) {
				out += " " + attr
				const val = e.attrs[attr]
				if (val) out += "=" + replaceVariables(val, variables)
			}
		}

		// Append id & class
		if (e.id) out += ` id="${e.id}"`
		if (e.clss && e.clss.length > 0) out += ` class="${e.clss.join(" ")}"`
		out += ">" // Close the opening tag

		// Append innerText and children (recursively)
		const isTooLong = (e.innerText ?? "").length > 70
		if (e.innerText && e.innerText.length > 0) {
			// Replace variables statically!
			const replacedInner = replaceVariables(e.innerText, variables)

			// Add to the output
			out += e.notMarkDown ? replacedInner
				: (isTooLong ? "\n\t" : "")
					+ markDownToHtml(replacedInner)
					+ (isTooLong ? "\n" : "")
		}
		if (e.children && e.children.length > 0)
			out += "\n\t" + (await gen(
				e.children, indent + 1, { ...variables, ...e.attrs }
			)).split("\n").join("\n\t")+ "\n"

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
 * Compiles a string of Spell code.
 * @param code The code
 * @param compileOptions The compile options for said code
 * @returns The compiled code
 */
export async function compile(
	code: string,
	compileOptions: CompileOptions
): Promise<string> {
	try {
		const parsed = parse(code, compileOptions)[0]
		const { els } = await modify(parsed, compileOptions)
		return gen(els, 0, {})
	} catch (e) {
		errorNoExit("Tried compiling:\n" + code)
		console.log(e)
		return ""
	}
}

// Run a simple test if this is ran standalone
if (import.meta.main) {
	const path = "test/index.spl"
	const f = await readTextFile(path)
	const out = compile(f, { filePath: path })
	console.log(out)
}
