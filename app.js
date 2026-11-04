const dateInput = document.querySelector("#date-input");
const dateForm = document.querySelector("#date-form");
const mediaFrame = document.querySelector("#media-frame");
const mediaLink = document.querySelector("#media-link");
const statusMessage = document.querySelector("#status");
const today = new Date().toISOString().slice(0, 10);

dateInput.max = today;
dateInput.value = today;

function setStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.dataset.error = String(isError);
}

function showPlaceholder(message, isError = false) {
  mediaFrame.replaceChildren();
  const messageNode = document.createElement("div");
  messageNode.className = "media-placeholder";
  messageNode.setAttribute("role", "status");
  messageNode.dataset.error = String(isError);
  messageNode.textContent = message;
  mediaFrame.append(messageNode);
}

function safeMediaUrl(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function formatDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function displayImage(data) {
  document.querySelector("#image-title").textContent = data.title || "Astronomy Picture of the Day";
  document.querySelector("#image-date").textContent = formatDate(data.date);
  document.querySelector("#image-date").dateTime = data.date;
  document.querySelector("#image-copyright").textContent = data.copyright ? `Image: ${data.copyright}` : "";
  document.querySelector("#image-explanation").textContent = data.explanation || "No description is available for this image.";

  const mediaUrl = safeMediaUrl(data.hdurl || data.url);
  if (data.media_type === "image" && mediaUrl) {
    const image = document.createElement("img");
    image.src = safeMediaUrl(data.url) || mediaUrl;
    image.alt = data.title || "NASA astronomy image";
    image.addEventListener("error", () => {
      showPlaceholder("This image could not be displayed. Try another date.", true);
    }, { once: true });
    mediaFrame.replaceChildren(image);
    mediaLink.href = mediaUrl;
    mediaLink.hidden = false;
    mediaLink.firstChild.textContent = "Explore the original image ";
  } else if (data.media_type === "video" && mediaUrl) {
    showPlaceholder("Today’s feature is a video. Open it to watch.");
    mediaLink.href = mediaUrl;
    mediaLink.hidden = false;
    mediaLink.firstChild.textContent = "Watch NASA’s video ";
  } else {
    showPlaceholder("No supported media is available for this date.", true);
    mediaLink.hidden = true;
  }
}

async function loadPicture(date) {
  dateInput.disabled = true;
  dateForm.querySelector("button").disabled = true;
  mediaLink.hidden = true;
  showPlaceholder("Loading today’s image…");
  setStatus("Connecting to NASA’s Astronomy Picture of the Day…");

  try {
    const response = await fetch(`https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY&date=${encodeURIComponent(date)}`);
    if (!response.ok) {
      throw new Error(response.status === 404 ? "No image is available for that date." : "NASA’s image service is temporarily unavailable.");
    }

    const data = await response.json();
    if (!data || !data.date || !["image", "video"].includes(data.media_type)) {
      throw new Error("NASA returned an unexpected response. Please try again.");
    }

    displayImage(data);
    setStatus("");
  } catch (error) {
    showPlaceholder(error.message || "Unable to load the image. Please try again.", true);
    setStatus(error.message || "Unable to load the image. Please try again.", true);
  } finally {
    dateInput.disabled = false;
    dateForm.querySelector("button").disabled = false;
  }
}

dateForm.addEventListener("submit", (event) => {
  event.preventDefault();
  loadPicture(dateInput.value);
});

loadPicture(today);
