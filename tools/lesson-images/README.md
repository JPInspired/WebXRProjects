# Lesson images for the lessons page

The pictures on the lessons page (`index.html`) are captured from the lessons themselves:
`assets/lessons/<lesson>.webp` (a still) and `<lesson>-loop.webp` (a short loop that plays when you hover over
the card, or when a card is in view on a phone). You only need this after adding or changing a lesson.

1. `npm install` here. It also needs Google Chrome (set `CHROME` to its path if it isn't in the usual place).
2. Serve the whole project with any static web server, e.g. `npx http-server ../.. -p 8080`.
3. `node capture.mjs http://localhost:8080/ frames <lesson-folder> --frames 30` (or `all` for every lesson).
   Each lesson is set up and framed by its entry in `SETUP` at the top of `capture.mjs`: add one for a new lesson
   (what to do first, and where the camera goes). The menus and class board are hidden, and lab benches get a soft
   studio backdrop.
4. `node build.mjs frames <lesson-folder>` writes the two images into `assets/lessons/`.
5. Add the lesson's card to `index.html` (copy an existing card in its subject's section and change the
   `data-lesson`, the image names, the tags, the title and the description).

The share picture (`assets/share.jpg`, shown when the lessons page link is shared) is made with
`node share-picture.mjs http://localhost:8080/` while the project is served as above.

Some pictures show third-party models: see `assets/lessons/CREDITS.md`.
