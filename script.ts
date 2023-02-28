const CONST_VAL = 20
const a = `Here's the number: ${CONST_VAL}`
function fn(p: string) {
	console.log(p)
}
if (CONST_VAL < 30)
	fn(a)
