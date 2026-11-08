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

Video entries from the API are detected and handled—either embedded or displayed with a working link—in a way that fits seamlessly into the gallery or modal

A random “Did You Know?” fact displays on load

The app can be installed as a PWA when served over HTTPS (GitHub Pages provides HTTPS). Its app shell is cached for offline loading, and successful NASA APOD API responses are cached for network-first fallback.

When the site opens in a browser, an installation dialog offers **Install** or **Not now**. Choose **Install NASA Explorer** later to reopen it. On supported browsers, **Install** opens the browser's confirmation; accept it to install the app. If the browser does not provide a prompt, the dialog gives manual instructions.

On Android, use the browser menu's **Install app** or **Add to Home screen** option if needed. On iPhone or iPad, open the site in Safari, tap **Share**, **Add to Home Screen**, and **Add**. On macOS Sonoma or later, Safari offers **File > Add to Dock**. On Windows, macOS, and Linux, Chrome or Edge may offer installation through the browser menu; desktop Firefox does not support installing this PWA. Browser and operating-system support varies: a website cannot create a desktop shortcut or silently install itself, and the browser or operating system decides whether a desktop shortcut is offered. Installation requires a supported browser and HTTPS (or localhost).

Controls are sized for touch, and the gallery and dialogs adapt to narrow screens. The startup dialog is suppressed when the app is running in its installed window. The install button remains available there and reports that it is already installed. A browser tab cannot reliably determine whether the app was installed previously, so it may offer installation again.

Run the regression tests with `node --test tests/app.test.js`.
