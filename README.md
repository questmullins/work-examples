# work-examples

This is a list of project examples I have worked on over the years.

They are internal tools I built for a packaging manufacturer, sanitized for sharing: every company, product, person and record in them is made up. Open the top-level `index.html` to browse them.

## Try them online

Six of them are rebuilt as working demos on [kno.plus/examples](https://kno.plus/examples/), running on made-up data and producing real output (vector art, Illustrator scripts, printable labels):

| Demo | Built from |
| --- | --- |
| [Print annotation builder](https://kno.plus/examples/annotation/) | `annotation-generator`, `illustrator-annotation-panel` |
| [Barcode maker](https://kno.plus/examples/barcode/) | `illustrator-barcode-panel` |
| [Mockup dieline](https://kno.plus/examples/dieline/) | `mockup-jsx-generator`, `mockup-request-form` |
| [Fill planner](https://kno.plus/examples/fill/) | `fill-density-converter`, `fill-recordings`, `density-calculator` |
| [Have we made it before?](https://kno.plus/examples/made-before/) | `sales-lookup` |
| [Press sheet labels](https://kno.plus/examples/labels/) | `press-sheet-label-maker`, `mockup-labels` |

## Swimlane Creator is now Freestyle

Swimlane Creator grew into [Freestyle](https://github.com/questmullins/freestyle), a free swimlane diagram tool with its own repo. Try it at [kno.plus/webtools/freestyle](https://kno.plus/webtools/freestyle/).

## Start with these

- `annotation-generator`
- `mockup-jsx-generator`
- `sales-lookup`
- `sample-review`
- `mockup-request-form`
- `field-id-explorer`

## How it fits together

- Each browser tool is a folder with its own `index.html`, and each works on its own.
- A `<script id="demo-backend">` block at the top of each page is a fake Quickbase: it answers the page's calls from made-up records held in the browser. Changes last until reload.
- Annotation Generator and Mockup Studio also carry a `<script id="demo-pages">` block with their Illustrator script templates.
- The `illustrator-*` folders and `quickbase-page-tools` are source only. They need Illustrator or a real Quickbase account.

## Known limits

- Mockup Studio scripts come from one simplified stand-in template, not production templates.
- Generated `.jsx` files have been checked as valid JavaScript but have not been run in Illustrator.
- Artwork previews are empty, and Tool Downloads links go nowhere.
- Numeric field IDs in the code are the original ones.
