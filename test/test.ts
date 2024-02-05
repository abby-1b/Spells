import { assertEquals } from 'https://deno.land/std@0.205.0/assert/mod.ts';

import { CompileOptions } from '../src/compile/compile-options.ts';
import { modify } from '../src/compile/compile.ts';
import { Element } from '../src/compile/parse.ts';

const baseCompileOptions: CompileOptions = {
  filePath: 'some-filepath.spl'
};

Deno.test({
  name: 'Modify test 1',
  async fn() {
    const els: Element[] = [ ];
    const modified = await modify(els, baseCompileOptions);
    assertEquals(modified, {
      els: [
        {
          tagName: '!DOCTYPE html',
          singleTag: true,
          file: baseCompileOptions.filePath
        },
        {
          tagName: 'html',
          children: [
            {
              tagName: 'head',
              file: baseCompileOptions.filePath,
              children: [
                {
                  tagName: 'meta',
                  file: baseCompileOptions.filePath,
                  attrs: {
                    name: '"viewport"',
                    content: '"width=device-width,initial-scale=1.0"'
                  }
                }
              ]
            },
            {
              tagName: 'body',
              file: baseCompileOptions.filePath,
              children: []
            }
          ],
          file: baseCompileOptions.filePath
        }
      ],
      tsSources: []
    });
  }
});
