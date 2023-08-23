
# Components

Components are an integral part of web development. Editable, customizable, and
most importantly: reusable.

Components in Spells are defined with a `@`. For example:
```pug
component-name(@)
	p This text is inside the component!
```

The first time you declare a component, it doesn't get added to the output HTML.
To actually use the component you've declared, you need to place it where you
want it:
```pug
component-name(@)
```

This will display the component wherever you've placed it. This is what the
generated HTML will look like:
```html
<div @ class="component-name">
	<p>This text is inside the component!</p>
</div>
```

<sub>Note: the @ attribute still stays on the element, though that might be
removed in later versions, but it's not a bother for now.</sub>

They can be defined at any point during the file, but do remember that they need
to be declared _before_ they're used.

The following would be wrong:
```pug
component(@)
component(@)
	p We're declaring the component after it's been used! This won't work.
```

It's wrong because we're using the component (see the top declaration, the one
that doesn't have any content) before declaring it! Don't do that.


