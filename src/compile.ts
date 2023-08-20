import { error, errorNoExit } from "./logging.ts"
import { markDownToHtml } from "./mdc.ts"
import { pathGoUp, readTextFileSync } from "./path.ts"

// TODO: implement variables (including dynamics!)

// This is here to at least throw *something* before the real SWC transformer
// is loaded. Sure, it'll likely error on the output file, but in the
// off-chance that the user really wrote normal JavaScript, this'll work.
/**
 * Compiles TypeScript code
 * @param source The code to be compiled
 * @param fileName The name of the file, used for source mapping
 * @param minify Whether or not to minify
 * @returns The outputted JavaScript code
 */
// deno-lint-ignore no-unused-vars
export let compileTS = (source: string, fileName?: string, minify?: boolean): string => source

let startedTSServer = 0 // 0: not started, 1: starting, 2: started
/** Starts the TypeScript compilation server */
export async function startTSServer() {
	// If it's already started, return immediately
	if (startedTSServer == 2) return
	if (startedTSServer == 1) {
		// If it's starting, wait for it to be initialized fully
		const wait = () => new Promise(resolve => setTimeout(resolve, 500))
		while (startedTSServer == 1) await wait()
		return
	}

	// If this is the first time we're starting it, let the others know
	startedTSServer = 1
	const innerTransform = (await import("https://deno.land/x/swc@0.2.1/mod.ts")).transform
	startedTSServer = 2
	console.log("TypeScript compiler loaded!")
	compileTS = (source: string, fileName?: string, minify?: boolean) => {
		const ret = innerTransform(source, {
			jsc: {
				target: "es2022",
				parser: { syntax: "typescript", tsx: true },
				minify: minify ? {
					compress: {
						arguments: true,
						arrows: true,
						booleans: true,
						collapse_vars: true,
						comparisons: true,
						conditionals: true,
						defaults: false,
						drop_console: true,
						drop_debugger: true,
						ecma: 5,
						hoist_props: true,
						if_return: true,
						inline: 0,
						join_vars: true,
						keep_classnames: true,
						keep_fargs: false,
						keep_fnames: true,
						keep_infinity: false,
						loops: true,
						passes: 3,
						properties: true,
						sequences: 20,
						side_effects: true,
						switches: true,
						typeofs: true,
						unsafe_math: true,
					}
				} : {}
			},
			sourceMaps: !!fileName, // Only include source maps if a filename is given
			minify
		})

		// The inline sourceMaps are not good, so we inline it ourselves.
		if (fileName) {
			// deno-lint-ignore no-explicit-any
			const sourceMap = JSON.parse((ret as any).map)
			sourceMap.sources[0] = fileName
			return ret.code + `\n//# sourceMappingURL=data:application/json;base64,${btoa(JSON.stringify(sourceMap))}`
		}

		return ret.code
	}
}

/** Tags that we won't apply MarkDown to */
const tagNoMarkDown = [
	"style",
	"css",
	"script"
]

/** Tags that will be moved to the `head` tag */
const tagHead = [
	"title",
	"css",
	"style",
	"meta",
	"link"
]

/**
 * Tags that don't have closing tags by default.
 * NOTE: Adding Text to any of these tags makes them still have a closing tag.
 */
const tagSingle = [
	"meta"
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
	return (lineNum + 1) + ":" + colNum
}

/**
 * Splits a string of attributes passed to a tag into separate strings
 * @param attr The attributes to be split
 * @returns The separated strings
 */
function splitModifiers(attr: string): string[] {
	const modifiers: string[] = []
	let curr = ""
	function push() {
		if (curr.length == 0) return
		modifiers.push(curr), curr = ""
	}
	for (let i = 0; i < attr.length; i++) {
		if (attr[i] == '"') {
			curr += attr[i]
			while (attr[++i] != '"')
				curr += attr[i]
			curr += attr[i++]
		}
		if (".#(".includes(attr[i])) push()
		curr += attr[i]
	}
	push()
	return modifiers
}

function replaceVariables(inputString: string, varDict: Record<string, string>): string {
	const ret = inputString.replace(/@{[a-zA-Z0-9_\-@]*?}/g, e => {
		const varName = e.slice(2, -1)
		if (!(varName in varDict)) return e
		let out = varDict[varName]
		if (out.startsWith('"') || out.startsWith("'")) out = out.slice(1, -1)
		return out
	})
	return ret
}

/** Characters that can be used inside a tag name. */
const nameChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXZY0123456789_-@"

/**
 * Parses a string into an element structure.
 * @param code The code we're parsing
 * @param indent The level of indentation that we're checking 
 * @returns The element structure, and the last character that it parsed
 */
function parse(
	code: string,
	indent = 0,
	startI = 0,
	parentVariables?: Record<string, any>
): [Element[], number] {
	code = (code + "\n").replace(/\G {4}/g, "\t")
	const els: Element[] = []
	let tagIndent = 0,
		tagName = "",
		i = startI
	for (; i < code.length; i++) {
		const c = code[i]
		if (nameChars.includes(c)) {
			tagName += c
			continue
		}

		// If a tab is found, increase the indent level
		if (c == "\t") tagIndent++
		
		// If there's no tag (so just a tab), don't let the code below run.
		if (tagName.length == 0) continue

		/// ONCE WE HAVE A TAG,

		// If a tag is found before the expected indent, break out of the loop.
		// This makes the element be processed by the outer function.
		if (tagIndent < indent) {
			i -= tagName.length + 1 + tagIndent
			break
		}

		// Get the things that are a part of the tag: class,
		// ID, and attributes. (+ the multi-line operator)
		let j = i, nest = 0
		while (true) {
			if ((code[j] == "\n" || code[j] == " ") && nest == 0) break
			if (code[j] == "(" || code[j] == "[" || code[j] == "{") nest++
			else if (code[j] == ")" || code[j] == "]" || code[j] == "}") nest--
			if (++j > code.length) error("Unmatched nest:", idxToPos(code, i))
		}
		const thingsString = code.slice(i, j); i = j
		const things = splitModifiers(thingsString.trim())

		// Get the attributes
		const attrs: Record<string, string> = {}
		things.filter(t => t[0] == "(").forEach(a => {
			const appendAttributes: string[] = []
			const splitString = a.slice(1, -1)
			let curr = ""

			for (let i = 0; i < splitString.length; i++) {
				if (splitString[i] == ',' || splitString[i] == ' ') {
					if (curr.length == 0) continue
					appendAttributes.push(curr)
					curr = ""
					continue
				} else if (splitString[i] == '"') {
					curr += splitString[i]
					while (splitString[++i] != '"')
						curr += splitString[i]
					curr += splitString[i]
					continue
				}
				curr += splitString[i]
			}
			if (curr.length > 0) appendAttributes.push(curr)
			
			appendAttributes.forEach(n => {
				const s = n.split("=")
				attrs[s[0].trim()] = s.slice(1).join("=")
			})
		})
		const variables = { ...attrs, ...parentVariables }

		// Get innerText / children
		const children: Element[] = []
		let innerText: string | undefined
		if (things[things.length - 1] == ".") {
			// If it ends with a dot, capture multiple lines of text after it
			const matches = [ ...code.matchAll(
				new RegExp(`^\t{0,${indent}}(?!\t)(?!$)`, "gm")
			) ]
			const endIndex = (
				matches.find(m => m.index! >= i) ?? { index: code.length - 1 }
			).index! - 1
			innerText = code.slice(i + 1, endIndex)
			i = endIndex
		} else {
			// If the string isn't multiline, it could still have some text!
			const until = code.indexOf("\n", i)
			innerText = code.slice(i + 1, until)
			i = until

			// If it's not multline, it can always have children!
			const [elements, finishI] = parse(code, indent + 1, i, variables)
			children.push(...elements)
			i = finishI
		}

		// Finally, push the element!
		els.push({
			tagName, attrs,
			clss: things.filter(t => t[0] == "." && t.length > 1).map(c => c.slice(1)),
			id: things.filter(t => t[0] == "#")[0]?.slice(1),
			innerText, children,
			notMarkDown: tagNoMarkDown.includes(tagName),
			singleTag: tagSingle.includes(tagName)
		} as Element)
		tagName = ""
		tagIndent = 0
	}
	return [els, i]
}

/**
 * Converts elements to their HTML representation.
 * @param els The element structure
 * @param indent The current level of indentation
 * @returns The generated string of HTML code
 */
function gen(els: Element[], indent = 0, variables: Record<string, string>): string {
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
			out += "\n\t" + gen(e.children, indent + 1, { ...variables, ...e.attrs })
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
 * appear in the oringal file (sections can't be used before they're declared).
 * This function modifies the element structure in place.
 * @param els The element structure we're crawling through
 */
function crawl(
	els: Element[],
	components: Record<string, Element>,
	isHead: boolean,
	options: CompileOptions
): {
	tsSources: string[],
	headElements: Element[]
} {
	const tsSources: string[] = []
	const headElements: Element[] = []
	for (let e = 0; e < els.length; e++) {
		let el = els[e]
		if ([
			"@import",
			"@require",
			"@include",
			"@requires",
			"@includes",
			"@needs",
			"@wants",
			"@desires",
			"@necessitates",
			"@steal-code-from"
		].includes(el.tagName)) {
			// We're importing another `.spl` file!
			// TODO: import HTML too

			if (!el.innerText) error("Please provide a file to import")
			const code = readTextFileSync(pathGoUp(options.filePath) + "/" + el.innerText!)
			const parsed = parse(code)[0]
			els.splice(e, 1, ...parsed)
			el = els[e]
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
				attrs: { ...c.attrs, ...el.attrs },
				clss: [el.tagName, ...el.clss ?? [], ...c.clss ?? []],
				id: c.id,
				innerText: c.innerText,
				children: [...c.children ?? [], ...el.children ?? []],
				singleTag: c.singleTag
			}
			const crawlResults = crawl(nel.children!, components, false, options)
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
				if (options.convertJStoTS) {
					// Replace .js with .ts
					if (el.attrs.src.endsWith(".ts"))
						el.attrs.src = el.attrs.src.slice(0, -2) + "js"
					else if (el.attrs.src.endsWith(".ts\""))
						el.attrs.src = el.attrs.src.slice(0, -3) + "js\""
				}
				tsSources.push(el.attrs.src)
			} else if (el.innerText) {
				el.innerText = compileTS(el.innerText)
			}
		}

		// TODO: parse a few attributes into CSS (maybe? maybe not?)

		// Crawl through the children
		if (el.children) {
			const crawlResults = crawl(el.children, components, false, options)
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
 * appears after code is parsed by most modern browsers.
 * @param els The element structure we're modifying
 * @returns An object with the elements in order, and a list of the TypeScript
 * sources found within the structure
 */
let headTag: Element
function modify(els: Element[], options: CompileOptions) {
	const hasTag = (el: Element, searchTag: string): boolean =>
		el.children ? !!el.children.find(e => e.tagName == searchTag) : false

	let htmlTag: Element
	headTag = undefined as unknown as Element
	const topTags = els.map(e => e.tagName)
	if (!topTags.includes("html")) {
		// Add <html> around everything
		htmlTag = {
			tagName: "html",
			children: els
		} as Element
		els = [ htmlTag ]
	} else htmlTag = els[topTags.indexOf("html")]
	if (!hasTag(htmlTag, "body")) {
		// Add <body> around everything after <head>
		const headIdx = htmlTag.children!.findIndex(c => c.tagName == "head")
		if (headIdx == -1) {
			// Make the head element
			headTag = { tagName: "head", children: [] }
		} else {
			// Get the head element
			headTag = htmlTag.children![headIdx]
			htmlTag.children!.splice(headIdx, 1)
		}
		htmlTag.children = [{
			tagName: "body",
			children: htmlTag.children!
		} as Element]
	} else {
		// Just the head element
		if (hasTag(htmlTag, "head"))
			headTag = htmlTag.children!.find(t => t.tagName == "head")!
		else {
			headTag = { tagName: "head", children: [] }
			htmlTag.children?.unshift(headTag)
		}
	}

	// <meta name="viewport" content="width=device-width, initial-scale=1.0">
	headTag.children!.push({
		tagName: "meta",
		attrs: {name: '"viewport"', content: '"width=device-width,initial-scale=1.0"'}
	})

	const components = {}
	crawl(headTag.children ?? [], components, true, options)

	const crawlResults = crawl(els, {}, false, options)
	headTag.children!.push(...crawlResults.headElements)

	htmlTag.children!.unshift(headTag)

	// Add <!DOCTYPE html> at the beginning of the document
	els.unshift({
		tagName: "!DOCTYPE html",
		singleTag: true
	} as Element)

	return {
		els,
		foundTSSources: crawlResults.tsSources
	}
}

interface CompileOptions {
	convertJStoTS?: boolean
	filePath: string
}

/**
 * Compiles a string of Spell code.
 * @param code The code
 * @param options The compile options for said code
 * @returns The compiled code
 */
export function compile(code: string, options: CompileOptions): string {
	try {
		const parsed = parse(code)[0]
		const { els } = modify(parsed, options)
		return gen(els, 0, {})
	} catch (e) {
		errorNoExit("Tried compiling:\n" + code)
		console.log(e)
		return ""
	}
}

// Run a simple test if the compile function is ran standalone.
if (import.meta.main) {
	const path = "test/index.spl"
	const f = readTextFileSync(path)
	const out = compile(f, { filePath: path })
}
