export interface CompileOptions {
  /** The path of the file that's currently being compiled */
  filePath: string

  /**
   * Whether or not output files should have `.js` wherever `.ts` appears
   */
  convertExtensionTStoJS?: boolean

  /** The path that we're compiling to in the end */
  mapPaths?: string
}
