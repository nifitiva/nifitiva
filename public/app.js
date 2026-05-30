// ==========================================================================
// NIFITIVA AUTOMATOR WORKSPACE CLIENT CONTROLLER
// ==========================================================================

const API_BASE = window.location.origin;
let appConfig = {};
let scheduledQueue = [];

// Curated Trends for Radar Feed
const TRENDING_GADGETS = [
  { title: "Flame Ambient Air Humidifier", vol: "+480% this week", img: "https://images.unsplash.com/photo-1519183071298-a2962feb14f4?w=150", category: "Smart Appliances", price: 899, pinUrl: "https://pinterest.com/pin/1" },
  { title: "Astronaut Galaxy Star Projector", vol: "+320% this week", img: "https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=150", category: "Home Decor", price: 1299, pinUrl: "https://pinterest.com/pin/2" },
  { title: "Smart LED RGB Hexagon Wall Panels", vol: "+290% this week", img: "https://images.unsplash.com/photo-1563089145-599997674d42?w=150", category: "Home Decor", price: 1899, pinUrl: "https://pinterest.com/pin/3" },
  { title: "Automatic Smart Pet Food Feeder", vol: "+250% this week", img: "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=150", category: "Smart Appliances", price: 2999, pinUrl: "https://pinterest.com/pin/4" }
];

document.addEventListener("DOMContentLoaded", () => {
  initDashboard();
});

async function initDashboard() {
  initClock();
  await loadConfig();
  await refreshDashboard();
  loadTrendsRadar();
  
  // Set up polling for log console updates
  setInterval(async () => {
    await checkActivePostingUpdates();
  }, 10000);
}

function initClock() {
  const clockNode = document.getElementById("nav-clock");
  function tick() {
    const now = new Date();
    clockNode.innerHTML = `<i class="fa-regular fa-clock"></i> Local Time: ${now.toLocaleTimeString()}`;
  }
  tick();
  setInterval(tick, 1000);
}

// --- CONFIGURATION HANDLERS ---
async function loadConfig() {
  try {
    const res = await fetch(`${API_BASE}/api/config`);
    appConfig = await res.json();
    
    // Fill Settings inputs
    document.getElementById("config-amazon-tag").value = appConfig.amazonTag || "mallika-21";
    document.getElementById("config-pinterest-token").value = appConfig.pinterestAccessToken || "";
    document.getElementById("config-pinterest-board-id").value = appConfig.pinterestBoardId || "";
    document.getElementById("config-pinterest-board-name").value = appConfig.pinterestBoardName || "";
    document.getElementById("config-simulation").checked = appConfig.simulationMode;
    
    updateSimulationBadge(appConfig.simulationMode);
  } catch (error) {
    console.error("Failed to load config:", error);
    showToast("Error loading active configurations.", "error");
  }
}

async function saveConfig(e) {
  if (e) e.preventDefault();
  
  const amazonTag = document.getElementById("config-amazon-tag").value.trim();
  const pinterestAccessToken = document.getElementById("config-pinterest-token").value.trim();
  const pinterestBoardId = document.getElementById("config-pinterest-board-id").value.trim();
  const pinterestBoardName = document.getElementById("config-pinterest-board-name").value.trim();
  const simulationMode = document.getElementById("config-simulation").checked;

  try {
    const res = await fetch(`${API_BASE}/api/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amazonTag,
        pinterestAccessToken,
        pinterestBoardId,
        pinterestBoardName,
        simulationMode
      })
    });
    
    appConfig = await res.json();
    showToast("Configurations saved successfully!");
    addConsoleLog("SYSTEM", `Configurations updated. Amazon tag set to "${amazonTag}".`);
    updateSimulationBadge(appConfig.simulationMode);
    
  } catch (error) {
    showToast("Failed to save configuration.", "error");
  }
}

function toggleSimulationMode(checked) {
  fetch(`${API_BASE}/api/config`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ simulationMode: checked })
  })
  .then(res => res.json())
  .then(data => {
    appConfig.simulationMode = data.simulationMode;
    updateSimulationBadge(data.simulationMode);
    showToast(data.simulationMode ? "Simulation Mode Active" : "Real Pinterest Posting Active");
    addConsoleLog("SYSTEM", `Simulation mode toggled to: ${data.simulationMode ? 'ON' : 'OFF'}`);
  });
}

function updateSimulationBadge(isSim) {
  const badge = document.querySelector("#pinterest-api-settings-panel");
  if (isSim) {
    badge.classList.add("text-muted");
    addConsoleLog("SYSTEM", "Automator running in virtual simulation. Real board tokens bypassed.");
  } else {
    badge.classList.remove("text-muted");
  }
}

// --- ANALYTICS & REFRESH ---
async function refreshDashboard() {
  try {
    // 1. Fetch Stats
    const statsRes = await fetch(`${API_BASE}/api/analytics`);
    const stats = await statsRes.json();
    
    document.getElementById("val-products").innerText = stats.totalProducts;
    document.getElementById("val-queue").innerText = stats.scheduledPins;
    document.getElementById("val-clicks").innerText = stats.totalClicks.toLocaleString();
    document.getElementById("val-earnings").innerText = `₹${Math.round(stats.estEarnings).toLocaleString('en-IN')}`;
    
    // 2. Fetch Schedule Queue
    await loadScheduleQueue();
  } catch (error) {
    console.error("Dashboard refresh error:", error);
  }
}

async function loadScheduleQueue() {
  try {
    const res = await fetch(`${API_BASE}/api/pinterest/schedule`);
    scheduledQueue = await res.json();
    renderScheduleQueue();
  } catch (error) {
    console.error("Failed to load queue:", error);
  }
}

function renderScheduleQueue() {
  const container = document.getElementById("scheduler-queue-list");
  if (scheduledQueue.length === 0) {
    container.innerHTML = `
      <div class="empty-state-queue">
        <i class="fa-regular fa-calendar-xmark"></i>
        <p>No pins scheduled. Scrape a Pinterest video to add to queue!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = scheduledQueue.map(item => {
    const date = new Date(item.scheduleTime);
    const timeStr = date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isPending = item.status === 'Pending';
    const isPosted = item.status === 'Posted';
    
    return `
      <div class="timeline-item">
        <div class="timeline-node ${item.status.toLowerCase()}">
          <i class="${isPosted ? 'fa-solid fa-check' : isPending ? 'fa-regular fa-clock' : 'fa-solid fa-triangle-exclamation'}"></i>
        </div>
        <div class="timeline-content">
          <div class="timeline-details">
            <span class="timeline-title">${item.title}</span>
            <span class="timeline-time"><i class="fa-regular fa-calendar"></i> ${timeStr}</span>
            <span class="timeline-board"><i class="fa-solid fa-folder-open"></i> Board: ${item.boardName}</span>
          </div>
          <div class="timeline-actions">
            <span class="status-indicator-badge ${item.status.toLowerCase()}">${item.status}</span>
            ${isPosted ? `<a href="${item.pinUrl}" target="_blank" class="btn-link"><i class="fa-solid fa-square-arrow-up-right"></i> Pin</a>` : ''}
            ${isPending ? `<button class="btn-cancel-pin" onclick="cancelScheduledPin('${item.id}')" title="Cancel schedule"><i class="fa-solid fa-circle-minus"></i></button>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join("");
}

async function cancelScheduledPin(id) {
  if (!confirm("Are you sure you want to cancel this scheduled Pinterest post?")) return;
  
  try {
    const res = await fetch(`${API_BASE}/api/pinterest/schedule/${id}`, { method: "DELETE" });
    if (res.ok) {
      showToast("Scheduled pin cancelled successfully.");
      addConsoleLog("SCHEDULER", `Cancelled scheduled pin queue item.`);
      await refreshDashboard();
    }
  } catch (error) {
    showToast("Failed to cancel scheduled pin.", "error");
  }
}

// --- PINTEREST SCRAPER & VIDEO IMPORTER (CLIENT-SIDE) ---
async function analyzePinterestUrl() {
  const urlInput = document.getElementById("pinterest-url");
  const url = urlInput.value.trim();
  
  if (!url) {
    showToast("Please enter a valid Pinterest link.", "error");
    return;
  }

  const spinner = document.getElementById("analyze-spinner");
  const analyzeBtn = document.getElementById("btn-analyze");

  // Loading UI
  spinner.style.display = "inline-block";
  analyzeBtn.disabled = true;
  analyzeBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Analyzing...`;
  addConsoleLog("SCRAPER", `Scraping Pinterest Pin: "${url}"`);

  try {
    let data = null;
    
    // 1. Try local server-side scraper first (CORS-free and fast)
    try {
      const res = await fetch(`${API_BASE}/api/pinterest/fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });
      if (res.ok) {
        data = await res.json();
        addConsoleLog("SCRAPER", "[LOCAL ENGINE] Successfully resolved pin metadata.");
      } else {
        throw new Error("Local scraper bypassed, trying fallback CORS proxy...");
      }
    } catch (e) {
      console.warn(e.message);
      addConsoleLog("SCRAPER", "[FALLBACK] Resolving via browser CORS proxy...");
      
      // 2. Fallback: Browser-side scraper using AllOrigins CORS proxy
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error("CORS proxy resolved with an error. Please try again.");
      
      const html = await response.text();
      
      // Parse using browser's native DOMParser
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      
      let title = "";
      let description = "";
      let imageUrl = "";
      let videoUrl = "";
      
      // Check Standard Metatags
      const ogTitle = doc.querySelector('meta[property="og:title"]');
      if (ogTitle) title = ogTitle.getAttribute("content");
      
      const ogDesc = doc.querySelector('meta[property="og:description"]');
      if (ogDesc) description = ogDesc.getAttribute("content");
      
      const ogImage = doc.querySelector('meta[property="og:image"]');
      if (ogImage) imageUrl = ogImage.getAttribute("content");
      
      const ogVideo = doc.querySelector('meta[property="og:video"]') || doc.querySelector('meta[property="og:video:secure_url"]');
      if (ogVideo) videoUrl = ogVideo.getAttribute("content");
      
      if (!title) {
        const titleTag = doc.querySelector("title");
        if (titleTag) title = titleTag.textContent;
      }

      // Check application/ld+json script schemas
      const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
      scripts.forEach(script => {
        try {
          const json = JSON.parse(script.textContent);
          if (json) {
            const items = Array.isArray(json) ? json : [json];
            for (const item of items) {
              if (item['@type'] === 'VideoObject' || item.video) {
                const videoObj = item.video || item;
                if (videoObj.contentUrl) videoUrl = videoObj.contentUrl;
                if (videoObj.thumbnailUrl) imageUrl = videoObj.thumbnailUrl;
                if (item.name) title = item.name;
                if (item.description) description = item.description;
              } else if (item['@type'] === 'SocialMediaPosting' || item['@type'] === 'CreativeWork') {
                if (item.name) title = item.name;
                if (item.description) description = item.description;
                if (item.image) {
                  imageUrl = Array.isArray(item.image) ? item.image[0] : (item.image.url || item.image);
                }
              }
            }
          }
        } catch (e) {}
      });

      // Fallback Regex parsing on raw HTML string if media not resolved
      if (!videoUrl) {
        const mp4Regex = /"videoUrl"\s*:\s*"([^"]+)"/g;
        let match = mp4Regex.exec(html);
        if (match && match[1]) {
          videoUrl = match[1].replace(/\\u002F/g, '/');
        }
      }
      
      if (!videoUrl) {
        const pinimgVideoRegex = /https:\/\/v1\.pinimg\.com\/videos\/[^\s"']+\.mp4/g;
        let match = html.match(pinimgVideoRegex);
        if (match && match[0]) {
          videoUrl = match[0];
        }
      }

      data = {
        title,
        description,
        videoUrl,
        imageUrl,
        tags: []
      };
    }

    if (!data || (!data.videoUrl && !data.imageUrl)) {
      throw new Error("No media found inside the Pinterest page.");
    }

    const title = (data.title || "Pinterest Pin").replace(' | Pinterest', '').trim();
    const description = (data.description || "").replace(/Discover recipes, home ideas, style inspiration.*/i, '').trim();

    // 4. Fill form details in dashboard
    document.getElementById("edit-title").value = title;
    document.getElementById("edit-description").value = description;
    document.getElementById("edit-board").value = appConfig.pinterestBoardName || "Smart Home & Viral Finds";
    
    // Set default Amazon India affiliate keyword search URL
    const cleanedTitle = title.split(' ').slice(0, 3).join('+').replace(/[^\w\d+]/g, '');
    document.getElementById("edit-affiliate").value = `https://www.amazon.in/s?k=${cleanedTitle}`;
    
    // Pricing presets
    const randomPrice = Math.floor(Math.random() * 8 + 3) * 100 + 99; // Rs 399 - 1099
    document.getElementById("edit-price").value = randomPrice;
    document.getElementById("edit-original-price").value = Math.round(randomPrice * (Math.random() * 0.8 + 1.8));

    // Media renderer
    const videoNode = document.getElementById("preview-video");
    const imgNode = document.getElementById("preview-image");
    const mediaBadge = document.getElementById("preview-media-type");

    if (videoUrl) {
      videoNode.src = videoUrl;
      videoNode.style.display = "block";
      imgNode.style.display = "none";
      mediaBadge.innerText = "VIDEO EXTRACTED";
      mediaBadge.style.background = "rgba(236, 72, 153, 0.2)";
    } else {
      imgNode.src = imageUrl || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600";
      imgNode.style.display = "block";
      videoNode.style.display = "none";
      videoNode.src = "";
      mediaBadge.innerText = "IMAGE ONLY EXTRACTED";
      mediaBadge.style.background = "rgba(59, 130, 246, 0.2)";
    }

    // Schedule date configuration (Current + 2 hours default)
    const futureDate = new Date();
    futureDate.setHours(futureDate.getHours() + 2);
    const pad = (n) => String(n).padStart(2, '0');
    const localDateTime = `${futureDate.getFullYear()}-${pad(futureDate.getMonth()+1)}-${pad(futureDate.getDate())}T${pad(futureDate.getHours())}:${pad(futureDate.getMinutes())}`;
    document.getElementById("edit-schedule-time").value = localDateTime;

    // Toggle layouts
    document.getElementById("scraper-results-box").style.display = "block";
    showToast("Pinterest pin analyzed successfully!");
    addConsoleLog("SCRAPER", `[SUCCESS] Browser extracted video & metadata: "${title.substring(0, 30)}..."`);
    
    // Scroll to panel
    document.getElementById("scraper-results-box").scrollIntoView({ behavior: "smooth" });

  } catch (error) {
    showToast("Failed to scrape. Make sure it is a valid public Pinterest URL.", "error");
    addConsoleLog("ERROR", `Browser scraper failed: ${error.message}`);
  } finally {
    spinner.style.display = "none";
    analyzeBtn.disabled = false;
    analyzeBtn.innerHTML = "Analyze Pin";
  }
}

// Simulated AI Copy Generator
function rewriteAIPinDescription() {
  const descNode = document.getElementById("edit-description");
  const titleVal = document.getElementById("edit-title").value.trim();
  const currentDesc = descNode.value;

  if (!titleVal) {
    showToast("Please enter a title before rewriting description.", "error");
    return;
  }

  addConsoleLog("AI_WRITER", "Rewriting copy for maximal organic click-through rate (CTR)...");
  
  // Custom smart rewritten Pinterest template
  const rewritten = `😍 Omg, this is seriously a game-changer! You didn't know you needed this viral ${titleVal}! ✨

🏡 The ultimate aesthetic lifestyle hack for your modern home setup. Super functional, beautiful, and absolutely high quality. 

👇 Double tap if you need this! best price link is in my bio to shop right now! 🛍️

#amazonfinds #viralgadgets #smarthome #aestheticroom #homehacks #giftideas #organizinghacks`;

  // Animate character insertion
  descNode.value = "";
  let i = 0;
  function typeWriter() {
    if (i < rewritten.length) {
      descNode.value += rewritten.charAt(i);
      i++;
      setTimeout(typeWriter, 4); // Quick typewriter effect
    }
  }
  typeWriter();
  showToast("Copy optimized for Pinterest SEO!");
}

async function saveScrapedProduct() {
  const title = document.getElementById("edit-title").value.trim();
  const description = document.getElementById("edit-description").value.trim();
  const price = document.getElementById("edit-price").value;
  const originalPrice = document.getElementById("edit-original-price").value;
  const category = document.getElementById("edit-category").value;
  const boardName = document.getElementById("edit-board").value.trim();
  const affiliateUrl = document.getElementById("edit-affiliate").value.trim();
  const scheduleTime = document.getElementById("edit-schedule-time").value;

  const videoUrl = document.getElementById("preview-video").src;
  const imageUrl = document.getElementById("preview-image").src;

  if (!title || !price || !scheduleTime) {
    showToast("Title, price, and schedule time are required.", "error");
    return;
  }

  try {
    // 1. Save storefront product in catalog database
    const prodRes = await fetch(`${API_BASE}/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        price,
        originalPrice,
        category,
        videoUrl: videoUrl || "",
        imageUrl: imageUrl || "",
        affiliateUrl,
        rating: (Math.random() * 0.4 + 4.5).toFixed(1), // Random 4.5-4.9 rating
        tags: ["#viralfinds", `#${category.toLowerCase().replace(' ', '')}`]
      })
    });

    if (!prodRes.ok) throw new Error("Failed to save product in database.");
    const savedProduct = await prodRes.json();
    addConsoleLog("AUTOMATOR", `[WEBSITE] Synced new product to storefront: "${title}"`);

    // 2. Add to Pinterest Posting scheduler queue
    const scheduleRes = await fetch(`${API_BASE}/api/pinterest/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        videoUrl: savedProduct.videoUrl,
        imageUrl: savedProduct.imageUrl,
        affiliateUrl: savedProduct.affiliateUrl,
        boardName,
        scheduleTime
      })
    });

    if (!scheduleRes.ok) throw new Error("Failed to add pin to posting queue.");
    addConsoleLog("AUTOMATOR", `[PINTEREST] Pin scheduled for board "${boardName}" at ${new Date(scheduleTime).toLocaleString()}`);

    showToast("Product synced to storefront & scheduled on Pinterest!");
    resetScraper();
    await refreshDashboard();

  } catch (error) {
    showToast(error.message, "error");
    addConsoleLog("ERROR", `Failed to automate synced product: ${error.message}`);
  }
}

function resetScraper() {
  document.getElementById("pinterest-url").value = "";
  document.getElementById("scraper-results-box").style.display = "none";
  document.getElementById("preview-video").src = "";
  document.getElementById("preview-image").src = "";
}

// --- CONSOLE LOGGER HELPERS ---
function addConsoleLog(module, text) {
  const consoleContainer = document.getElementById("console-logs-container");
  if (!consoleContainer) return;

  const now = new Date();
  const timeStr = now.toLocaleTimeString();
  
  let colorClass = "text-muted";
  if (module === "ERROR") colorClass = "text-error";
  if (module === "SYSTEM") colorClass = "text-success";
  if (module === "WEBSITE" || module === "PINTEREST" || module === "AUTOMATOR") colorClass = "text-success";

  const line = document.createElement("div");
  line.className = `console-line ${colorClass}`;
  line.innerText = `[${timeStr}] [${module}] ${text}`;
  
  consoleContainer.appendChild(line);
  consoleContainer.scrollTop = consoleContainer.scrollHeight; // Auto-scroll
}

// Polling updates logs in terminal on scheduler posted outcomes
let lastLoggedIds = [];
async function checkActivePostingUpdates() {
  try {
    const res = await fetch(`${API_BASE}/api/pinterest/schedule`);
    const data = await res.json();
    
    data.forEach(item => {
      if (item.status === 'Posted' && !lastLoggedIds.includes(item.id)) {
        addConsoleLog("SCHEDULER", `[POSTED] Pin "${item.title}" successfully uploaded to Pinterest board "${item.boardName}". Link: ${item.pinUrl}`);
        addConsoleLog("STATS", `Organic Traffic: ${item.views} Views generated, ${item.clicks} Affiliate Clicks registered.`);
        lastLoggedIds.push(item.id);
        refreshDashboard(); // Sync analytics cards
      }
    });
  } catch (e) {}
}

// --- TRENDS RADAR SYNC ---
function loadTrendsRadar() {
  const container = document.getElementById("trends-grid-feed");
  container.innerHTML = TRENDING_GADGETS.map((item, idx) => `
    <div class="trend-item">
      <div class="trend-left">
        <span class="trend-rank">#${idx+1}</span>
        <img class="trend-image" src="${item.img}" alt="${item.title}">
        <div class="trend-details">
          <span class="trend-title">${item.title}</span>
          <span class="trend-vol"><i class="fa-solid fa-chart-line"></i> ${item.vol}</span>
        </div>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="importTrendProduct('${item.title}', '${item.category}', ${item.price})">
        <i class="fa-solid fa-sync"></i> Import & Post
      </button>
    </div>
  `).join("");
}

function importTrendProduct(title, category, price) {
  // Pre-load scraper inputs with this trend data to let them configure instantly
  document.getElementById("pinterest-url").value = "https://pinterest.com/pin/mock_trend";
  
  // Directly simulate scraping outcome for this product
  document.getElementById("edit-title").value = title;
  document.getElementById("edit-description").value = `🔥 Stunning viral gadget! This automatic ${title} is the ultimate lifesaver! #amazonfinds #smarthome`;
  document.getElementById("edit-board").value = "Amazing Home Finds";
  
  const cleanedTitle = title.split(' ').slice(0, 3).join('+');
  document.getElementById("edit-affiliate").value = `https://www.amazon.in/s?k=${cleanedTitle}`;
  document.getElementById("edit-price").value = price;
  document.getElementById("edit-original-price").value = Math.round(price * 2);
  document.getElementById("edit-category").value = category;

  // Media presets matching trends
  const videoNode = document.getElementById("preview-video");
  const imgNode = document.getElementById("preview-image");
  const mediaBadge = document.getElementById("preview-media-type");

  videoNode.src = "https://assets.mixkit.co/videos/preview/mixkit-steam-rising-from-a-cup-of-hot-coffee-42323-large.mp4";
  videoNode.style.display = "block";
  imgNode.style.display = "none";
  mediaBadge.innerText = "TREND VIDEO SYNCED";

  const futureDate = new Date();
  futureDate.setHours(futureDate.getHours() + 1);
  const pad = (n) => String(n).padStart(2, '0');
  const localDateTime = `${futureDate.getFullYear()}-${pad(futureDate.getMonth()+1)}-${pad(futureDate.getDate())}T${pad(futureDate.getHours())}:${pad(futureDate.getMinutes())}`;
  document.getElementById("edit-schedule-time").value = localDateTime;

  document.getElementById("scraper-results-box").style.display = "block";
  showToast("Trend product loaded! Edit details to push.");
  addConsoleLog("SCRAPER", `[TREND SYNC] Successfully pre-loaded trend specs for "${title}"`);
  
  document.getElementById("scraper-results-box").scrollIntoView({ behavior: "smooth" });
}

// --- MAGIC GITHUB PUBLISHER INTEGRATION ---
async function syncStorefrontToGitHub() {
  const terminal = document.getElementById("git-terminal-logs");
  const output = document.getElementById("git-terminal-output");
  
  terminal.style.display = "block";
  output.innerHTML = "nifitiva-sync-hub:~$ git status --porcelain\n";
  addConsoleLog("DEPLOYER", "Initiating 1-Click Sync to GitHub Pages repository...");

  try {
    const res = await fetch(`${API_BASE}/api/github/push`, { method: "POST" });
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.details || data.error || "Sync failed");
    }

    output.innerHTML += "nifitiva-sync-hub:~$ git add .\n";
    output.innerHTML += "nifitiva-sync-hub:~$ git commit -m 'Sync storefront products database'\n";
    output.innerHTML += "nifitiva-sync-hub:~$ git push origin main\n";
    output.innerHTML += "\n[SUCCESS] Deployed successfully to https://nifitiva.github.io/nifitiva/ !\n";
    output.innerHTML += "Console log details:\n" + data.consoleLog;
    
    showToast("Storefront successfully published live on GitHub Pages!");
    addConsoleLog("SYSTEM", "1-Click GitHub Sync completed. Website is now fully live and updated!");

  } catch (error) {
    output.innerHTML += `\n[ERROR] Sync failed:\n${error.message}\n\nTip: Local git authentication is required. Make sure 'git push' works from your normal command line!`;
    showToast("GitHub Pages Sync failed.", "error");
    addConsoleLog("ERROR", `GitHub sync failed: ${error.message}`);
  }
}

// --- NOTIFICATION TOAST SYSTEM ---
function showToast(text, type = "success") {
  const toast = document.getElementById("toast");
  const icon = document.getElementById("toast-icon");
  const textNode = document.getElementById("toast-text");
  
  textNode.innerText = text;
  toast.className = `toast ${type === 'error' ? 'error' : ''}`;
  
  if (type === "error") {
    icon.className = "fa-solid fa-circle-xmark";
  } else {
    icon.className = "fa-solid fa-circle-check";
  }
  
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 4000);
}

// --- SCRAPED MEDIA DIRECT DOWNLOADER ---
function downloadScrapedMedia() {
  const videoNode = document.getElementById("preview-video");
  const imgNode = document.getElementById("preview-image");
  
  let mediaUrl = "";
  if (videoNode.style.display !== "none" && videoNode.src) {
    mediaUrl = videoNode.src;
  } else if (imgNode.style.display !== "none" && imgNode.src) {
    mediaUrl = imgNode.src;
  }
  
  if (!mediaUrl) {
    showToast("No active media URL found to download.", "error");
    return;
  }
  
  addConsoleLog("DOWNLOADER", "Triggering download stream for active media file...");
  
  // Open in a new tab where they can right-click -> 'Save Video As'
  const win = window.open(mediaUrl, "_blank");
  if (win) {
    showToast("Scraped video opened in new tab! Right-click -> 'Save Video As' to download.");
  } else {
    showToast("Pop-up blocked! Please allow pop-ups to download.", "error");
  }
}
