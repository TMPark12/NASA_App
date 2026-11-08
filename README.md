# NASA_App
School project for NASA

Create an HTML page that fetches the 9 most recent NASA pictures

Display pictures in a rotating gallery

Fetches up to 9 consecutive days of APOD data when a date is selected, using a valid API key. The date range is limited to NASA's archive, which starts June 16, 1995.

Dynamically creates and displays up to 9 gallery items using API data, including image, title, and date

Clicking an image opens a modal with full-size image, title, date, and explanation

Uses colors and fonts to align with NASA’s design

Loading message appears while data is loading and is removed after the gallery displays

An accessible in-app notification confirms how many entries loaded and their date range. It appears when the gallery is loaded, not as a background or browser push notification.

When a gallery request or picture fails to load, a dialog offers a page refresh. Image entries try their alternate resolution first, when available. NASA Science's feed supplies the actual image when the APOD API returns a NASA logo placeholder.

Video entries from the API are detected and handled—supported YouTube embeds are displayed in the modal, while other HTTP(S) videos have a link. Invalid video URLs show an unavailable message.

A random “Did You Know?” fact displays on load

The app can be installed as a PWA when served over HTTPS (GitHub Pages provides HTTPS). Its app shell is cached for offline loading, and successful NASA APOD API responses are cached for network-first fallback.

On the first browser visit, an installation dialog offers **Install** or **Not now**. This offer is remembered in local storage for that browser and site; clearing site data or using another browser may show it again. If storage is unavailable, the automatic offer is skipped. Choose **Install NASA Explorer** at any time to reopen it. On supported browsers, **Install** opens the browser's confirmation; accept it to install the app. If the browser does not provide a prompt, the dialog gives manual instructions.

On Android, use the browser menu's **Install app** or **Add to Home screen** option if needed. On iPhone or iPad, open the site in Safari, tap **Share**, **Add to Home Screen**, and **Add**. On macOS Sonoma or later, Safari offers **File > Add to Dock**. On Windows, macOS, and Linux, Chrome or Edge may offer installation through the browser menu; desktop Firefox does not support installing this PWA. Browser and operating-system support varies: a website cannot create a desktop shortcut or silently install itself, and the browser or operating system decides whether a desktop shortcut is offered. Installation requires a supported browser and HTTPS (or localhost).

Controls are sized for touch, and the gallery and dialogs adapt to narrow screens. The startup dialog is suppressed when the app is running in its installed window. The install button remains available there and reports that it is already installed. A browser tab cannot reliably determine whether the app was installed previously.

Run the regression tests with `node --test tests/app.test.js`.
