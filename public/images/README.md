# Images

The landing page currently pulls two real photographs straight from Unsplash's
public CDN (see the `<img src="https://images.unsplash.com/...">` tags in
`public/index.html`). They load in the visitor's browser and are free to use.

## Want to use your own photos instead?
1. Drop your image files in this folder, e.g. `hero.jpg` and `band.jpg`.
2. In `public/index.html`, change the two `src="https://images.unsplash.com/..."`
   values to `src="images/hero.jpg"` and `src="images/band.jpg"`.

If an image ever fails to load, the page shows a soft gradient placeholder
automatically — it never looks broken.
