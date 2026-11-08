# NASA_App
School project for NASA

Create an HTML page that fetches the 9 most recent NASA pictures

Display pictures in a rotating gallery

Fetches APOD data for 9 consecutive days based on selected dates, using a valid API key

Dynamically creates and displays 9 gallery items using API data, including image, title, and date

Clicking an image opens a modal with full-size image, title, date, and explanation

Uses colors and fonts to align with NASA’s design

Loading message appears while data is loading and is removed after the gallery displays

Video entries from the API are detected and handled—either embedded or displayed with a working link—in a way that fits seamlessly into the gallery or modal

A random “Did You Know?” fact displays on load

Gallery images scale up smoothly on hover, with an expanded view capped at 75% of the screen

The app can be installed as a PWA when served over HTTPS (GitHub Pages provides HTTPS). Its app shell is cached for offline loading, and successful NASA APOD API responses are cached for network-first fallback.

Use **Save Me For Later** to open the install prompt when available, or follow the browser's installation instructions. The button remains available in the installed app and reports that it is already installed. A browser tab cannot reliably determine whether the app was installed previously.
