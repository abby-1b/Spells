
# Including Code

No hassle, no issue. Just write a word that vaguely resemmbles `import`, and it
should work.

```pug
@import some.spl
@imports some.spl
@require some.spl
@requires some.spl
@include some.spl
@includes some.spl
@need some.spl
@needs some.spl
@want some.spl
@wants some.spl
@desire some.spl
@desires some.spl
@necessitate some.spl
@necessitates some.spl
@steal-code-from some.spl
@steals-code-from some.spl
```

All of these work.

Includes re-use code across files. Whenever you include something, its code is
placed where the include was placed.

Although discouraged, this can be used as an analogue to components.

`pseudo-component.spl`
```pug
div
	p Please don't do this. Use components instead!
```
`index.spl`
```pug
div
	@import pseudo-component.spl
div
	p Please.
	@import pseudo-component.spl
```

For now, these only works for Spells files, but importing HTML will be a feature
in the future!

