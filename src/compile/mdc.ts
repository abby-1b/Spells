// So this is a file I made a few years back to parse markdown into HTML. It's
// quick and dirty, absolutely inefficient, but it works for now. If there are
// more speed concerns later on in the project, this is a very good place to
// start looking for potential optimizations.

/**
 * Convert MarkDown to HTML
 * @param md Provided MarkDown
 * @returns The converted HTML string
 */
export function markDownToHtml(md: string): string {
  return md

  // Replace everything that could affect the html things!
  // .replace(`&`, "&amp;")
  // .replace(`<`, "&lt;")
  // .replace(`>`, "&gt;")
  // .replace(`"`, "&quot;")
  // .replace(`'`, "&#039;")

  // Headers (#)
    .replace(/^(\s*)(#{1,6} )(?=.*$)/gm, e => '<h' + e.trim().length + '>')
    .replace(/^<h[0-9]>.*/gm, e => e + '</' + e.split('>')[0].slice(1) + '>')
    
  // Lists
    .replace(/^(\s*?)~(\s|)/gm, '<li>')

  // Closes all list items
    .replace(/^<li.*/gm, e => e + '</li>')
  
  // Links
    .replace(/\[.*?]\(.*?\)/gm, e => `<a href=\"${e.split('](')[1].slice(0,-1)}\">${e.split('](')[0].slice(1)}</a>`)

  // Bold, italics, combinations of <
    .replace(/\*\*[^*]*?\*\*/gm, e => '<b>' + e.slice(2, -2) + '</b>')
    .replace(/\*[^*]*?\*/gm, e => '<i>' + e.slice(1, -1) + '</i>')
    .replace(/_.*?_/gm, e => '<i>' + e.slice(1, -1) + '</i>')
  
  // Monospace (`like this`)
    .replace(/\`[^\`]{1,}\`(?!`)/gm, e => '<code>' + e.slice(1, -1) + '</code>')
    .replace(/```(.|\n)*?```/gm, e => '<br><code>' + e.slice(3, -3).replace(/\n/g, '<br>') + '</code>')

  // Superscript (x^this_is_sup)
    .replace(/\^.+?(?=\s|$)/g, e => '<sup>' + e.slice(1) + '</sup>')

  // Subscript isn't implemented due to underscore conflicting with italics
  
  // Spacers (newlines, basically)
    .replace(/\\/g, '\n<br>')
    .replace(/\n\n/gm, '\n<br>')

  // Removes some unused things
    .replace(/\n\</g, '<')
    .replace(/>\n/g, '>')
  
  // Images
    .replace(/%\(.*?\)%/gm, e => `<img src="./${e.slice(2, -2)}" style='width:100%'>`);
}
