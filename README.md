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

On Android, tap **Save Me For Later** and accept the install prompt. If no prompt appears, use the browser menu's **Install app** or **Add to Home screen** option. On iPhone or iPad, open the site in Safari, tap **Save Me For Later** for instructions, then tap **Share**, **Add to Home Screen**, and **Add**. iOS does not allow the site to open the install prompt itself. The app includes home-screen icons for both platforms. Installation requires a supported browser and HTTPS (or localhost).

Controls are sized for touch, and the gallery and dialog adapt to narrow screens. The install button remains available in the installed app and reports that it is already installed. A browser tab cannot reliably determine whether the app was installed previously.

Run the regression tests with `node --test tests/app.test.js`.
