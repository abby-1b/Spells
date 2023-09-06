export interface CompileOptions {
	/** The path of the file that's currently being compiled */
	filePath: string

	/** Whether or not we should convert JS to TS when compiling */
	convertJStoTS?: boolean

	/** The path that we're compiling to in the end */
	mapPaths?: string
}
