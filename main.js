// ── CAROUSEL (Monday.com powered) ────────────────────────────────
let current  = 0;
let autoplay = null;

function getSlides() {
  return document.querySelectorAll(".carousel-container .slide");
}

function showSlide(index) {
  const slides = getSlides();
  if (!slides.length) return;
  slides.forEach(s => s.classList.remove("active"));
  slides[index].classList.add("active");
}

function startAutoplay() {
  stopAutoplay();
  autoplay = setInterval(() => {
    const slides = getSlides();
    current = (current + 1) % slides.length;
    showSlide(current);
  }, 5000);
}

function stopAutoplay() {
  clearInterval(autoplay);
}

function bindCarouselControls() {
  const container = document.querySelector(".carousel-container");
  if (!container) return;

  container.querySelector(".next")?.addEventListener("click", () => {
    const slides = getSlides();
    current = (current + 1) % slides.length;
    showSlide(current);
  });

  container.querySelector(".prev")?.addEventListener("click", () => {
    const slides = getSlides();
    current = (current - 1 + slides.length) % slides.length;
    showSlide(current);
  });

  container.addEventListener("mouseenter", stopAutoplay);
  container.addEventListener("mouseleave", startAutoplay);
}

function buildSlides(items) {
  const container = document.querySelector(".carousel-container");
  if (!container) return;

  // Remove old slides (keep nav buttons)
  container.querySelectorAll(".slide").forEach(s => s.remove());
  const prevBtn = container.querySelector(".prev");

  // Default fallback slides if monday returns nothing
  if (!items || !items.length) {
    items = [
      {
        organization: "Youth Development Impact",
        story: "Over 3,000 local youth gained access to mentorship programs.",
        imageUrl: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?q=80&w=1600"
      },
      {
        organization: "Community Partnerships",
        story: "Partnered with 45 organizations across Milwaukee County.",
        imageUrl: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=1600"
      },
      {
        organization: "Healthcare Support",
        story: "Funded 597 life-saving procedures for families in need.",
        imageUrl: "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?q=80&w=1600"
      }
    ];
  }

  // Preload all images before inserting slides so they're ready to display
  const imagePromises = items.map((item, i) => {
    if (!item.imageUrl) return Promise.resolve();
    return new Promise(resolve => {
      const img = new Image();
      // Hint the browser to prioritise the first (visible) image
      if (i === 0) img.fetchPriority = "high";
      img.onload = img.onerror = resolve;
      img.src = item.imageUrl;
    });
  });

  // Insert slides immediately (shimmer shows while images load)
  items.forEach((item, i) => {
    const slide = document.createElement("div");
    slide.className = "slide" + (i === 0 ? " active" : "");

    if (item.imageUrl) {
      const wrap = document.createElement("div");
      wrap.className = "slide-img-wrap";

      const img = document.createElement("img");
      img.alt = item.organization;
      if (i === 0) img.fetchPriority = "high";
      // Fade the image in the moment it's decoded
      img.onload = () => {
        img.classList.add("img-ready");
        wrap.classList.add("loaded");
      };
      img.onerror = () => { wrap.style.display = "none"; };
      img.src = item.imageUrl;

      wrap.appendChild(img);
      slide.appendChild(wrap);
    }

    const story = document.createElement("div");
    story.className = "impact-story";
    story.innerHTML = `<h3>${item.organization}</h3><p>${item.story}</p>`;
    slide.appendChild(story);

    container.insertBefore(slide, prevBtn);
  });

  current = 0;
  stopAutoplay();
  startAutoplay();
}

async function initCarousel() {
  // Show fallback slides immediately so the carousel is usable right away
  buildSlides(null);

  // Fetch real data in the background and swap in silently when ready
  try {
    const items = await fetchCarouselItems();
    if (items && items.length > 0) {
      buildSlides(items);
      console.log("[Carousel] Loaded " + items.length + " slide(s) from Monday.");
    }
  } catch (err) {
    console.warn("[Carousel] Could not load Monday slides, keeping placeholders:", err);
  }
}

// Run on load — mondayAPI.js is loaded before this so fetchCarouselItems is available
window.addEventListener("load", () => {
  bindCarouselControls();
  initCarousel();
});


// ── NAV SMOOTH SCROLL WITH OFFSET ───────────────
const NAVBAR_HEIGHT = 68;

document.querySelectorAll(".nav-link").forEach(link => {
  link.addEventListener("click", function (e) {
    const href = this.getAttribute("href");
    if (!href || !href.startsWith("#")) return;
    const target = document.querySelector(href);
    if (!target) return;
    e.preventDefault();
    // Small rAF delay ensures layout is settled before we measure
    requestAnimationFrame(() => {
      const top = target.getBoundingClientRect().top + window.pageYOffset - NAVBAR_HEIGHT;
      window.scrollTo({ top, behavior: "smooth" });
    });
  });
});


// ── ACTIVE NAV LINK (scroll-based) ──────────────
const navLinks = document.querySelectorAll(".nav-link");

// All tracked anchors in document order (top to bottom)
const anchorIds = ["home", "history", "impact", "events", "grant", "donation", "contact"];

function getAnchorTop(id) {
  const el = document.getElementById(id);
  if (!el) return Infinity;
  return el.getBoundingClientRect().top + window.pageYOffset;
}

function setActiveLink(href) {
  navLinks.forEach(link => {
    link.classList.toggle("active", link.getAttribute("href") === href);
  });
}

function onScroll() {
  const scrollY = window.pageYOffset + NAVBAR_HEIGHT + 10;

  // Walk from bottom to top — first anchor whose top is <= scrollY wins
  let activeId = anchorIds[0];
  for (let i = anchorIds.length - 1; i >= 0; i--) {
    const top = getAnchorTop(anchorIds[i]);
    if (scrollY >= top) {
      activeId = anchorIds[i];
      break;
    }
  }
  setActiveLink("#" + activeId);
}

window.addEventListener("scroll", onScroll, { passive: true });
onScroll(); // run once on load


// ── DONATION FORM ────────────────────────────────
document.getElementById("donationForm").addEventListener("submit", function(e) {
  e.preventDefault();

  const name   = document.getElementById("donorName").value.trim();
  const amount = parseFloat(document.getElementById("donationAmount").value);
  const msg    = document.getElementById("donationMessage");

  if (!amount || amount <= 0) {
    msg.style.color = "#C0392B";
    msg.innerText = "Please enter a valid donation amount.";
    return;
  }

  msg.style.color = "#1C2E4A";
  msg.innerText = "Thank you, " + name + "! Your $" + amount.toLocaleString() + " donation makes a real difference.";
  this.reset();
});


// ── GRANT FORM ───────────────────────────────────
// Handled by mondayAPI.js

// ── BREWERS SCORE WIDGET ─────────────────────────
// Handled by the inline <script> in index.html (MLB Stats API)