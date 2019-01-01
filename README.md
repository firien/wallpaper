# Wallpaper

Create wallpaper for iphone with photos as icons.

Browser requirements

* Resize options for [createImageBitmap](https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/createImageBitmap)
* [OffscreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas) in WorkerGlobalScope


Caveats

* Does not process Apple's new HEIC format.


Uses [gh-pwa](https://github.com/firien/gh-pwa) to build docs/ folder.

---

### Development

    npx webpack-dev-server

---

### TODO

* move icon
* delete image
* heic format
* high density displays
* window resize
* zoom centered on pointer
