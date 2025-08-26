
// If using Flask default: '/static/images/default-poster.png'
const FALLBACK_POSTER = '/static/images/default-poster.png';


// ===== GLOBAL MODAL-TOAST HELPER (reusable) =====
function openToast(html) {
  const modal  = document.getElementById('ticketModal');
  const body   = document.getElementById('ticketModalBody');
  const closer = document.getElementById('modalClose');
  if (!modal || !body) { 
    // fallback
    alert(html.replace(/<[^>]+>/g, '')); 
    return; 
  }

  body.innerHTML = html;
  modal.classList.remove('trailer');
  modal.classList.add('toast');
  modal.style.display = 'flex';
  lockScroll();

  const content = modal.querySelector('.modal-content');
  if (content && closer && closer.parentNode !== content) content.appendChild(closer);

  function closeAll() {
    modal.style.display = 'none';
    body.innerHTML = '';
    modal.classList.remove('toast');
    modal.classList.remove('trailer');
    unlockScroll();
    if (closer && closer.parentNode !== modal) modal.appendChild(closer);
    closer?.removeEventListener('click', closeAll);
    window.removeEventListener('click', backdropClose);
  }
  function backdropClose(e){ if (e.target === modal) closeAll(); }

  closer?.addEventListener('click', closeAll);
  window.addEventListener('click', backdropClose);
}


const slides = [
  {
    title: "Experience Cinema Like Never Before",
    subtitle: "Book your favorite movies with premium comfort and state-of-the-art technology",
    buttonText: "Explore Movies 🎬",
    buttonAction: () => document.getElementById("movies")?.scrollIntoView({ behavior: "smooth" }),
   background: "Index.Html_Page_Images/Slideshow/Images/FirstSlideImage.jpeg"

  },
  {
    title: "Try Our New Dining Feature",
    subtitle: "Enjoy premium meals and snacks delivered right to your seat",
    buttonText: "Explore Dining 🍔",
    buttonAction: () =>  window.open("https://spicegardenmenu.netlify.app/","_blank"),
    background: "Index.Html_Page_Images/Slideshow/Images/SecondSlideImage.jpg"
  },
  {
    title: "For Real Time Booking",
    subtitle: "Watch movies in 4DX, IMAX, and Dolby Atmos sound technology",
    buttonText: "Book Tickets 🎟",
    buttonAction: () => window.open("https://in.bookmyshow.com/", "_blank"),
    background: "Index.Html_Page_Images/Slideshow/Images/ThirdSlideImage.png"
  },
  // add this slide object in your slides array (kahin bhi pehle wale 3 ke baad)
{
    // 🆕 Video Slide
    title: "''Where Magic Lives''",
    videoUrl: "Index.Html_Page_Images/Slideshow/Videos/HeroSectionSlide4VideoTheater.mp4",
    poster: "images/trailer-poster.jpg"
  }
];
let textFadeTimeout = null; // track the fade timeout for title/subtitle
let REVIEW_RATING = 0;

let currentSlide = 0;
const heroSection = document.querySelector(".hero");
const titleEl = document.getElementById("hero-title");
const subtitleEl = document.getElementById("hero-subtitle");
const buttonEl = document.getElementById("hero-button");
// render dots dynamically from slides length
const dotsContainer = document.querySelector('.hero-dots');
function renderDots() {
  if (!dotsContainer) return;
  dotsContainer.innerHTML = '';
  slides.forEach((_, i) => {
    const span = document.createElement('span');
    span.className = 'dot' + (i === 0 ? ' active' : '');
    span.addEventListener('click', () => showSlide(i));
    dotsContainer.appendChild(span);
  });
}
renderDots();
const dots = document.querySelectorAll('.dot'); // now matches slides


// ===== CONFIG =====
const FALLBACK_BG = './images/default-hero.jpg'; // adjust to your fallback local path

// keep existing globals

let sliderInterval = null;
let videoEl = null;
let videoTimeout = null;

// UTILITY: preload image -> returns Promise
function preloadImage(path) {
  return new Promise((resolve, reject) => {
    if (!path) return reject(new Error('no-path'));
    const raw = String(path).replace(/^url\(['"]?(.+?)['"]?\)$/, '$1');
    const img = new Image();
    img.onload = () => resolve(raw);
    img.onerror = () => reject(new Error('failed-to-load:' + raw));
    img.src = raw;
  });
}

// set hero background safely (uses preload)
function setHeroBackground(path) {
  const rawPath = path ? String(path).replace(/^url\(['"]?(.+?)['"]?\)$/, '$1') : null;
  if (!heroSection) return Promise.resolve();

  // if no background specified -> set fallback immediately
  if (!rawPath) {
    heroSection.style.backgroundImage = `url('${FALLBACK_BG}')`;
    return Promise.resolve(FALLBACK_BG);
  }

  // set a subtle placeholder/fallback while loading (avoids flash of nothing)
  heroSection.style.backgroundImage = `url('${FALLBACK_BG}')`;

  return preloadImage(rawPath)
    .then(p => {
      // ensure repaint after image is loaded
      requestAnimationFrame(() => {
        heroSection.style.backgroundImage = `url('${p}')`;
      });
      console.log('[slider] background set:', p);
      return p;
    })
    .catch(err => {
      console.warn('[slider] preload failed for', rawPath, err);
      // fallback remains
      return FALLBACK_BG;
    });
}

// CLEANUP video (removes immediately and clears timers)
function clearVideo() {
  if (videoTimeout) {
    clearTimeout(videoTimeout);
    videoTimeout = null;
  }
  if (videoEl) {
    try { videoEl.pause(); } catch (e) {}
    try { videoEl.removeEventListener('ended', onVideoEnded); } catch(e) {}
    if (videoEl.parentNode) videoEl.parentNode.removeChild(videoEl);
    videoEl = null;
  }

  // restore UI text/button (no background changes here)
  // remove video-active marker so button shows again for image slides
if (heroSection) heroSection.classList.remove('video-active');

  if (titleEl) {
    titleEl.classList.remove('fade-out');
    titleEl.style.opacity = 1;
    titleEl.style.transition = '';
  }
  if (subtitleEl) {
    subtitleEl.classList.remove('fade-out');
    subtitleEl.style.opacity = 1;
    subtitleEl.style.transition = '';
  }
  if (buttonEl) {
    buttonEl.style.display = '';
  }

  console.log('[slider] video cleared');
}

// handler when video ends
function onVideoEnded() {
  console.log('[slider] video ended event');
  if (videoTimeout) { clearTimeout(videoTimeout); videoTimeout = null; }
  nextSlide();
}

// start/stop auto slider (unchanged behavior: only advance when current isn't a video)
function stopAutoSlider() {
  if (sliderInterval) {
    clearInterval(sliderInterval);
    sliderInterval = null;
  }
}
function startAutoSlider() {
  stopAutoSlider();
  sliderInterval = setInterval(() => {
    const s = slides[currentSlide];
    if (!s || !s.videoUrl) {
      nextSlide();
    } else {
      console.log('[slider] skipping auto next because current is video');
    }
  }, 10000);
}

// NEXT slide helper
function nextSlide() {
  showSlide((currentSlide + 1) % slides.length);
}

// MAIN: showSlide (robust)
function showSlide(index) {
  if (!heroSection || !titleEl || !subtitleEl || !buttonEl) {
    console.warn('[slider] required DOM elements missing');
    return;
  }

  index = (index + slides.length) % slides.length;
  currentSlide = index;
  const s = slides[index] || {};

  console.log('[slider] showSlide', index, s.title || s.videoUrl || s.background);

  // Update dots if available (use live query to avoid stale NodeList)
  document.querySelectorAll('.dot').forEach((dot, i) => dot.classList.toggle('active', i === index));

  // Reset text opacity before changing content (prevents weird transitions)
  titleEl.style.transition = '';
  subtitleEl.style.transition = '';
  titleEl.style.opacity = 1;
  subtitleEl.style.opacity = 1;
  titleEl.classList.remove('fade-out');
  subtitleEl.classList.remove('fade-out');

  // update text/button content
  titleEl.textContent = s.title || '';
  subtitleEl.textContent = s.subtitle || '';
  buttonEl.textContent = s.buttonText || '';
  buttonEl.onclick = s.buttonAction || null;
  buttonEl.style.display = s.videoUrl ? 'none' : '';

  // If it's a video slide
  if (s.videoUrl) {
    console.log('[slider] activating video slide');
    // stop auto-advance
    stopAutoSlider();

    // remove any existing background visibility so video becomes visible
    // but DO NOT permanently clear background; we will restore later when next image slide loads
    // (we'll temporarily set background to fallback to avoid blank)
    heroSection.style.backgroundImage = `url('${FALLBACK_BG}')`;

    // cleanup previous video if any
    clearVideo();
   heroSection.classList.add('video-active');
    // create video element
    videoEl = document.createElement('video');
    videoEl.className = 'hero-video';
    videoEl.src = s.videoUrl;
    if (s.poster) videoEl.poster = s.poster;
    videoEl.autoplay = true;
    videoEl.muted = true;
    videoEl.playsInline = true;
    videoEl.preload = 'auto';
    videoEl.setAttribute('webkit-playsinline', '');
    videoEl.setAttribute('playsinline', '');
    videoEl.style.opacity = 1;
    

    // insert as first child so .hero-content (z-index:2) stays above it
    heroSection.insertBefore(videoEl, heroSection.firstChild);

    // attach ended listener
    videoEl.addEventListener('ended', onVideoEnded);

    // fade out text after 2s
    // fade out text after 2s ONLY if this is the last slide
if (index === slides.length - 1) {
  // clear any previous text fade timer
  if (textFadeTimeout) {
    clearTimeout(textFadeTimeout);
    textFadeTimeout = null;
  }
  textFadeTimeout = setTimeout(() => {
    titleEl.classList.add('fade-out');
    subtitleEl.classList.add('fade-out');
    textFadeTimeout = null;
  }, 2000);
} else {
  // for other video slides, ensure text remains visible
  titleEl.classList.remove('fade-out');
  subtitleEl.classList.remove('fade-out');
}


    // attempt autoplay; if blocked, show poster but still keep ended listener removed,
    // and set a safe maximum timeout to avoid infinite stuckness
    const playPromise = videoEl.play();
    if (playPromise && playPromise.catch) {
      playPromise.catch((err) => {
        console.warn('[slider] video autoplay blocked', err);
        // still ensure we move forward after a reasonable time (10s)
        if (videoTimeout) clearTimeout(videoTimeout);
        videoTimeout = setTimeout(() => {
          if (videoEl) try { videoEl.pause(); } catch(e){}
          nextSlide();
        }, 10000);
      });
    } else {
      // older browsers: ensure fallback timeout
      if (videoTimeout) clearTimeout(videoTimeout);
      videoTimeout = setTimeout(() => {
        if (videoEl) try { videoEl.pause(); } catch(e){}
        nextSlide();
      }, 10000);
    }

    return; // done for video slide
  }

  // NORMAL IMAGE slide -> ensure video removed first, then set background via preload
  // Clear any existing video immediately
  clearVideo();

  // set background (preload ensures it will appear even after video)
  // Accept both "images/..." or "url('...')"
  const bgPath = s.background ? s.background : null;
  setHeroBackground(bgPath).then(p => {
    // ensure auto slider runs for images
    startAutoSlider();
  });
}

// --------- Initialization: ensure DOM ready and start slider ----------
document.addEventListener('DOMContentLoaded', () => {
  // ensure dots exist (re-render if necessary)
  if (typeof renderDots === 'function') {
    try { renderDots(); } catch(e){ console.warn('renderDots failed', e); }
  }

  // show first slide and start
  showSlide(0);
  // tiny delay for startAutoSlider to avoid racing with initial video load
  setTimeout(() => startAutoSlider(), 80);
});





const movies = [
    {
        id: 1,
        title: "Avatar: The Way of Water",
        poster: "Index.Html_Page_Images/NowShowingImages(Movie Card)/Avatar The Way of Water.jpg",
        rating: "PG-13",
        duration: "3h 12m",
        genre: "Sci-Fi, Adventure",
        description: "Set more than a decade after the events of the first film, Avatar: The Way of Water begins to tell the story of the Sully family (Jake, Neytiri, and their kids), the trouble that follows them, the lengths they go to keep each other safe, the battles they fight to stay alive, and the tragedies they endure.",
        language :"English",
        basePrice:15.99,
        cast: [{ name: "Sam Worthington", role: "Jake Sully", image: "Booking.Html_Page_Images/Movies/Avatar Way Of Water/Cast/Sam Worthington.jpg",link: "https://en.wikipedia.org/wiki/Sam_Worthington" },
            { name: "Zoe Saldana", role: "Neytiri", image: "Booking.Html_Page_Images/Movies/Avatar Way Of Water/Cast/Zoe Saldana.jpg",link: "https://en.wikipedia.org/wiki/Zoe_Salda%C3%B1a" },
            { name: "Sigourney Weaver", role: "Kiri", image: "Booking.Html_Page_Images/Movies/Avatar Way Of Water/Cast/Sigourney Weaver.jpg",link: "https://en.wikipedia.org/wiki/Sigourney_Weaver" },
            { name: "Stephen Lang", role: "Colonel Quaritch", image: "Booking.Html_Page_Images/Movies/Avatar Way Of Water/Cast/Stephen Lang.jpg" ,link: "https://en.wikipedia.org/wiki/Stephen_Lang"},],
        director: {
    name: "James Cameron",
    image: "Booking.Html_Page_Images/Movies/Avatar Way Of Water/Director/James Cameron.jpg",
    link: "https://en.wikipedia.org/wiki/James_Cameron"
  },
        posterThumb: "Booking.Html_Page_Images/Movies/Avatar Way Of Water/Avatar Way Of Water.jpg",
        trailer: "https://www.youtube.com/embed/d9MyW72ELq0",
        imdbLink: "https://www.imdb.com/title/tt1630029/"
        
    },
    {
        id: 2,
        title: "Top Gun: Maverick",
        poster: "Index.Html_Page_Images/NowShowingImages(Movie Card)/Top-Gun-Maverick.jpg",
        rating: "PG-13",
        duration: "2h 11m",
        genre: "Action, Drama",
        description: "More than thirty years later, Maverick is still one of the Navy’s top aviators, pushing the limits as a fearless test pilot. When he is tasked with training TOP GUN’s best graduates for a dangerous mission, he must confront his past, sacrifice, and destiny.",
         basePrice:15.99,
        
         language :"English",
        cast: [
  { 
    name: "Tom Cruise", 
    role: "Captain Pete 'Maverick' Mitchell", 
    image: "Booking.Html_Page_Images/Movies/Top Gun Maverick/Cast/Tom Cruise.jpg", 
    link: "https://en.wikipedia.org/wiki/Tom_Cruise" 
  },
  { 
    name: "Miles Teller", 
    role: "Lt. Bradley 'Rooster' Bradshaw", 
    image: "Booking.Html_Page_Images/Movies/Top Gun Maverick/Cast/MilesTeller.png", 
    link: "https://en.wikipedia.org/wiki/Miles_Teller" 
  },
  { 
    name: "Jennifer Connelly", 
    role: "Penny Benjamin", 
    image: "Booking.Html_Page_Images/Movies/Top Gun Maverick/Cast/Jennifer Connelly.jpg", 
    link: "https://en.wikipedia.org/wiki/Jennifer_Connelly" 
  },
  { 
    name: "Jon Hamm", 
    role: "Vice Admiral Beau 'Cyclone' Simpson", 
    image: "Booking.Html_Page_Images/Movies/Top Gun Maverick/Cast/Jon Hamm.jpg", 
    link: "https://en.wikipedia.org/wiki/Jon_Hamm" 
  },
],
       director: { 
  name: "Joseph Kosinski",
  image: "Booking.Html_Page_Images/Movies/Top Gun Maverick/Director/Joseph Kosinski.jpg",
  link: "https://en.wikipedia.org/wiki/Joseph_Kosinski",
  imdb: "https://www.imdb.com/title/tt1745960/"
},
  posterThumb: "Booking.Html_Page_Images/Movies/Top Gun Maverick/TopGunMaverick.jpg",
  trailer: "https://www.youtube.com/embed/qSqVVswa420",

    },
    
{
  id: 3,
  title: "Joker 2",
  poster: "Index.Html_Page_Images/NowShowingImages(Movie Card)/Joker 2.jpg",
  rating: "R",
  duration: "2h 18m",
  genre: "Crime, Drama, Musical",
  description: "After the chaos of his transformation, Arthur Fleck struggles with his fractured psyche and newfound infamy. When he crosses paths with Harley Quinn, their bond spirals into a haunting duet of love, madness, and violence, reshaping Gotham in a chilling tale of shared delusion.",
  basePrice: 15.99,
  language: "English",

  cast: [
    { 
      name: "Joaquin Phoenix", 
      role: "Arthur Fleck / Joker", 
      image: "Booking.Html_Page_Images/Movies/Joker 2/Cast/Joaquin Phoenix.jpg", 
      link: "https://en.wikipedia.org/wiki/Joaquin_Phoenix" 
    },
    { 
      name: "Lady Gaga", 
      role: "Dr. Harleen Quinzel / Harley Quinn", 
      image: "Booking.Html_Page_Images/Movies/Joker 2/Cast/Lady Gaga.jpg", 
      link: "https://en.wikipedia.org/wiki/Lady_Gaga" 
    },
    { 
      name: "Zazie Beetz", 
      role: "Sophie Dumond", 
      image: "Booking.Html_Page_Images/Movies/Joker 2/Cast/Zazie Beetz.jpg", 
      link: "https://en.wikipedia.org/wiki/Zazie_Beetz" 
    },
    { 
      name: "Brendan Gleeson", 
      role: "TBA", 
      image: "Booking.Html_Page_Images/Movies/Joker 2/Cast/Brendan Gleeson.jpg", 
      link: "https://en.wikipedia.org/wiki/Brendan_Gleeson" 
    },
  ],

  director: { 
    name: "Todd Phillips",
    image: "Booking.Html_Page_Images/Movies/Joker 2/Cast/Todd Phillips.jpg",
    link: "https://en.wikipedia.org/wiki/Todd_Phillips",
    imdb: "https://www.imdb.com/title/tt11315808/"
  },

  posterThumb: "Booking.Html_Page_Images/Movies/Joker 2/Joker2.jpg",
  trailer: "https://www.youtube.com/embed/_OKAwz2MsJs",
  imdbLink: "https://www.imdb.com/title/tt11315808/"
}
,
   {
  id: 4,
  title: "Spider-Man: No Way Home",
  poster: "Index.Html_Page_Images/NowShowingImages(Movie Card)/Spider-Man No Way Home.jpg",
  rating: "PG-13",
  duration: "2h 28m",
  genre: "Action, Adventure",
  description: "With his identity exposed, Peter Parker seeks Doctor Strange’s aid. But when the spell shatters reality, villains from other universes arrive, threatening his world. To protect his loved ones and save countless lives, Peter must face impossible choices, ultimate sacrifice, and the true meaning of heroism.",
  basePrice: 15.99,
  language: "English",

  cast: [
    { 
      name: "Tom Holland", 
      role: "Peter Parker / Spider-Man", 
      image: "Booking.Html_Page_Images/Movies/Spiderman No Way Home/Cast/Tom Holland.jpg", 
      link: "https://en.wikipedia.org/wiki/Tom_Holland_(actor)" 
    },
    { 
      name: "Zendaya", 
      role: "MJ", 
      image: "Booking.Html_Page_Images/Movies/Spiderman No Way Home/Cast/Zendaya.jpg", 
      link: "https://en.wikipedia.org/wiki/Zendaya" 
    },
    { 
      name: "Benedict Cumberbatch", 
      role: "Doctor Strange", 
      image: "Booking.Html_Page_Images/Movies/Spiderman No Way Home/Cast/Benedict Cumberbatch.jpg", 
      link: "https://en.wikipedia.org/wiki/Benedict_Cumberbatch" 
    },
    { 
      name: "Jacob Batalon", 
      role: "Ned Leeds", 
      image: "Booking.Html_Page_Images/Movies/Spiderman No Way Home/Cast/Jacob Batalon.jpg", 
      link: "https://en.wikipedia.org/wiki/Jacob_Batalon" 
    }
  ],

  director: { 
    name: "Jon Watts",
    image: "Booking.Html_Page_Images/Movies/Spiderman No Way Home/Director/Jon Watts.jpg",
    link: "https://en.wikipedia.org/wiki/Jon_Watts",
    imdb: "https://www.imdb.com/name/nm1218281/"
  },

  posterThumb: "Booking.Html_Page_Images/Movies/Spiderman No Way Home/SpidermanNoWayHome.jpg",
  trailer:"https://www.youtube.com/embed/JfVOs4VSpmA",
  imdbLink: "https://www.imdb.com/title/tt10872600/"
},

    {
  id: 5,
  title: "The Batman",
  poster: "Index.Html_Page_Images/NowShowingImages(Movie Card)/The Batman.jpg",
  rating: "PG-13",
  duration: "2h 56m",
  genre: "Action, Crime",
  description: "When a sadistic killer leaves cryptic clues, Batman descends into Gotham’s dark underworld. As the evidence draws closer to home, he must uncover the truth, confront deep corruption, and seek justice for a broken city, while facing trials that test his resolve and identity.",
  basePrice: 15.99,
  language: "English",

  cast: [
    { 
      name: "Robert Pattinson", 
      role: "Bruce Wayne / Batman", 
      image: "Booking.Html_Page_Images/Movies/The Batman/Cast/Robert Pattinson.jpg", 
      link: "https://en.wikipedia.org/wiki/Robert_Pattinson" 
    },
    { 
      name: "Zoë Kravitz", 
      role: "Selina Kyle / Catwoman", 
      image: "Booking.Html_Page_Images/Movies/The Batman/Cast/Zoë Kravitz.jpg", 
      link: "https://en.wikipedia.org/wiki/Zo%C3%AB_Kravitz" 
    },
    { 
      name: "Paul Dano", 
      role: "Edward Nashton / Riddler", 
      image: "Booking.Html_Page_Images/Movies/The Batman/Cast/Paul Dano.jpg", 
      link: "https://en.wikipedia.org/wiki/Paul_Dano" 
    },
    { 
      name: "Jeffrey Wright", 
      role: "Lt. James Gordon", 
      image: "Booking.Html_Page_Images/Movies/The Batman/Cast/Jeffrey Wright.jpg", 
      link: "https://en.wikipedia.org/wiki/Jeffrey_Wright" 
    }
  ],

  director: { 
    name: "Matt Reeves",
    image: "Booking.Html_Page_Images/Movies/The Batman/Director/Matt Reeves.jpg",
    link: "https://en.wikipedia.org/wiki/Matt_Reeves",
    imdb: "https://www.imdb.com/name/nm0716257/"
  },

  posterThumb: "Booking.Html_Page_Images/Movies/The Batman/TheBatman.jpg",
  trailer: "https://www.youtube.com/embed/mqqft2x_Aa4",
  imdbLink: "https://www.imdb.com/title/tt1877830/"
}
,
    {
  id: 6,
  title: "Dune",
  poster: "Index.Html_Page_Images/NowShowingImages(Movie Card)/Dune.jpg",
  rating: "PG-13",
  duration: "2h 35m",
  genre: "Sci-Fi, Adventure",
  description: "Paul Atreides, a gifted young man bound to a destiny beyond his grasp, journeys to the desert world of Arrakis. Amid treachery, survival, and war over the spice that powers empires, he must embrace his fate to protect his family, his people, and the future.",
  basePrice: 15.99,
  language: "English",

  cast: [
    { 
      name: "Timothée Chalamet", 
      role: "Paul Atreides", 
      image: "Booking.Html_Page_Images/Movies/Dune/Cast/Timothée Chalamet.jpg", 
      link: "https://en.wikipedia.org/wiki/Timoth%C3%A9e_Chalamet" 
    },
    { 
      name: "Rebecca Ferguson", 
      role: "Lady Jessica Atreides", 
      image: "Booking.Html_Page_Images/Movies/Dune/Cast/Rebecca Ferguson.jpg", 
      link: "https://en.wikipedia.org/wiki/Rebecca_Ferguson" 
    },
    { 
      name: "Oscar Isaac", 
      role: "Duke Leto Atreides", 
      image: "Booking.Html_Page_Images/Movies/Dune/Cast/Oscar Isaac.jpg", 
      link: "https://en.wikipedia.org/wiki/Oscar_Isaac" 
    },
    { 
      name: "Zendaya", 
      role: "Chani", 
      image: "Booking.Html_Page_Images/Movies/Spiderman No Way Home/Cast/Zendaya.jpg",  
      link: "https://en.wikipedia.org/wiki/Zendaya" 
    }
  ],

  director: { 
    name: "Denis Villeneuve",
    image: "Booking.Html_Page_Images/Movies/Dune/Director/Denis Villeneuve.jpg",
    link: "https://en.wikipedia.org/wiki/Denis_Villeneuve",
    imdb: "https://www.imdb.com/name/nm0898288/"
  },

  trailer: "https://www.youtube.com/embed/n9xhJrPXop4",
  posterThumb: "Booking.Html_Page_Images/Movies/Dune/Dune.jpg",
  imdbLink: "https://www.imdb.com/title/tt1160419/"
}
,

  {
  id: 7,
  title: "Avengers: Endgame",
  poster: "Index.Html_Page_Images/NowShowingImages(Movie Card)/Avengers Endgame.jpg",
  rating: "PG-13",
  duration: "3h 1m",
  genre: "Action, Adventure, Sci-Fi",
  description: "After Thanos’s devastating actions shatter the universe, the remaining Avengers must unite once more. Facing grief, sacrifice, and impossible odds, they embark on a desperate mission to reverse the damage, restore balance, and decide the fate of existence in the ultimate battle for survival.",
  basePrice: 15.99,
  language: "English",

  cast: [
    { 
      name: "Robert Downey Jr.", 
      role: "Tony Stark / Iron Man", 
      image: "Booking.Html_Page_Images/Movies/Avengers Endgame/Cast/Robert Downey Jr..jpg", 
      link: "https://en.wikipedia.org/wiki/Robert_Downey_Jr." 
    },
    { 
      name: "Chris Evans", 
      role: "Steve Rogers / Captain America", 
      image: "Booking.Html_Page_Images/Movies/Avengers Endgame/Cast/Chris Evans.jpg", 
      link: "https://en.wikipedia.org/wiki/Chris_Evans_(actor)" 
    },
    { 
      name: "Chris Hemsworth", 
      role: "Thor", 
      image: "Booking.Html_Page_Images/Movies/Avengers Endgame/Cast/Chris Hemsworth.jpg", 
      link: "https://en.wikipedia.org/wiki/Chris_Hemsworth" 
    },
    { 
      name: "Scarlett Johansson", 
      role: "Natasha Romanoff / Black Widow", 
      image: "Booking.Html_Page_Images/Movies/Avengers Endgame/Cast/Scarlett Johansson.jpg", 
      link: "https://en.wikipedia.org/wiki/Scarlett_Johansson" 
    }
  ],

  director: { 
    name: "Anthony and Joe Russo",
    image: "Booking.Html_Page_Images/Movies/Avengers Endgame/Director/Anthony and Joe Russo.jpg",
    link: "https://en.wikipedia.org/wiki/Russo_brothers",
    imdb: "https://www.imdb.com/name/nm0751577/"
  },

  posterThumb: "Booking.Html_Page_Images/Movies/Avengers Endgame/Avengers Endgame.jpg",
  trailer: "https://www.youtube.com/embed/TcMBFSGVi1c",
  imdbLink: "https://www.imdb.com/title/tt4154796/"
},


{
  id: 8,
  title: "Black Adam",
  poster: "Index.Html_Page_Images/NowShowingImages(Movie Card)/Black Adam.jpg",
  rating: "PG-13",
  duration: "2h 05m",
  genre: "Action, Adventure, Fantasy",
  description: "After being imprisoned for millennia, Black Adam is unleashed with the powers of ancient Egyptian gods. Wielding his own brutal sense of justice, he shakes the world order, drawing the attention of the Justice Society and igniting a clash that will decide the fate of humanity.",
  basePrice: 15.99,
  language: "English",

  cast: [
    { 
      name: "Dwayne Johnson", 
      role: "Teth-Adam / Black Adam", 
      image: "Booking.Html_Page_Images/Movies/Black Adam/Cast/Dwayne Johnson.jpg", 
      link: "https://en.wikipedia.org/wiki/Dwayne_Johnson" 
    },
    { 
      name: "Aldis Hodge", 
      role: "Carter Hall / Hawkman", 
      image: "Booking.Html_Page_Images/Movies/Black Adam/Cast/Aldis Hodge.jpg", 
      link: "https://en.wikipedia.org/wiki/Aldis_Hodge" 
    },
    { 
      name: "Pierce Brosnan", 
      role: "Kent Nelson / Doctor Fate", 
      image: "Booking.Html_Page_Images/Movies/Black Adam/Cast/Pierce Brosnan.jpg", 
      link: "https://en.wikipedia.org/wiki/Pierce_Brosnan" 
    },
    { 
      name: "Noah Centineo", 
      role: "Albert Rothstein / Atom Smasher", 
      image: "Booking.Html_Page_Images/Movies/Black Adam/Cast/Noah Centineo.jpg", 
      link: "https://en.wikipedia.org/wiki/Noah_Centineo" 
    }
  ],

  director: { 
    name: "Jaume Collet-Serra",
    image: "Booking.Html_Page_Images/Movies/Black Adam/Director/Jaume Collet-Serra.jpg",
    link: "https://en.wikipedia.org/wiki/Jaume_Collet-Serra",
    imdb: "https://www.imdb.com/name/nm1429471/"
  },

  posterThumb: "Booking.Html_Page_Images/Movies/Black Adam/Black Adam.jpg",
  trailer: "https://www.youtube.com/embed/X0tOpBuYasI",
  imdbLink: "https://www.imdb.com/title/tt6443346/"
},


{
  id: 9,
  title: "Thor: Love and Thunder",
  poster: "Index.Html_Page_Images/NowShowingImages(Movie Card)/Thor Love and Thunder.jpg",
  rating: "PG-13",
  duration: "1h 58m",
  genre: "Action, Adventure, Comedy",
  description: "Thor sets out on a quest for inner peace, unlike any he has faced before. But his journey is interrupted by Gorr the God Butcher, a relentless galactic killer with mysterious powers, whose ruthless mission to annihilate the gods threatens the cosmos and beyond.",
  basePrice: 15.99,
  language: "English",

  cast: [
    { 
      name: "Chris Hemsworth", 
      role: "Thor", 
      image: "Booking.Html_Page_Images/Movies/Avengers Endgame/Cast/Chris Hemsworth.jpg", 
      link: "https://en.wikipedia.org/wiki/Chris_Hemsworth" 
    },
    { 
      name: "Natalie Portman", 
      role: "Jane Foster / Mighty Thor", 
      image: "Booking.Html_Page_Images/Movies/Thor Love and Thunder/Cast/Natalie Portman.jpg",
      link: "https://en.wikipedia.org/wiki/Natalie_Portman" 
    },
    { 
      name: "Christian Bale", 
      role: "Gorr the God Butcher", 
      image: "Booking.Html_Page_Images/Movies/Thor Love and Thunder/Cast/Christian Bale.jpg",  
      link: "https://en.wikipedia.org/wiki/Christian_Bale" 
    },
    { 
      name: "Tessa Thompson", 
      role: "Valkyrie", 
      image: "Booking.Html_Page_Images/Movies/Thor Love and Thunder/Cast/Tessa Thompson.jpg", 
      link: "https://en.wikipedia.org/wiki/Tessa_Thompson" 
    }
  ],

  director: { 
    name: "Taika Waititi",
    image: "Booking.Html_Page_Images/Movies/Thor Love and Thunder/Director/Taika Waititi.jpg",
    link: "https://en.wikipedia.org/wiki/Taika_Waititi",
    imdb: "https://www.imdb.com/name/nm0169806/"
  },

  posterThumb: "Booking.Html_Page_Images/Movies/Thor Love and Thunder/Thor Love and Thunder.png",
  trailer: "https://www.youtube.com/embed/Go8nTmfrQd8",
  imdbLink: "https://www.imdb.com/title/tt10648342/"
}

];

function showSection(sectionId) {
    // Sab sections hide karo
    const sections = [
        "movies",
        "theaters",
        "offers-section",
        "reviews-section",
        "about",
        "contact",
        "my-bookings" // corrected id used in index.html
    ];

    sections.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add("hidden-section");
    });

    // Jo section click hua hai use show karo
    const target = document.getElementById(sectionId);
    if (target) target.classList.remove("hidden-section");

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}


function enhanceDateInputs() {
  // 👉 apne actual selector se match karao:
  const dateInputs = document.querySelectorAll(
    '.theater-card .date-input, .theater-card .date-picker, input[name="showDate"], #showDate'
  );

  dateInputs.forEach(inp => {
    // if theater has an id, use it to persist per-theater
    const theater = inp.closest('.theater-card');
    const key = theater?.dataset.theaterId ? `theaterDate_${theater.dataset.theaterId}` : null;

    // init: restore last remembered value
    const saved = key ? localStorage.getItem(key) : null;
    if (!inp.value && saved) {
      inp.value = saved;
      inp.dataset.last = saved;
    } else if (inp.value && !inp.dataset.last) {
      inp.dataset.last = inp.value;
      if (key) localStorage.setItem(key, inp.value);
    }

    // remember on change
    inp.addEventListener('change', () => {
      inp.dataset.last = inp.value;
      if (key && inp.value) localStorage.setItem(key, inp.value);
    });

    // restore on blur if cleared
    inp.addEventListener('blur', () => {
      if (!inp.value && inp.dataset.last) {
        inp.value = inp.dataset.last;
      }
    });
  });
}


// Navigation functionality
document.addEventListener('DOMContentLoaded', function() {
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');

    initReviewStars();   // ⭐ ye call karni hai



    // Re-render bookings when booking created in this tab (SPA)
window.addEventListener('bookingsUpdated', (e) => {
  if (typeof loadBookings === 'function') {
    loadBookings();
  } else if (typeof app !== 'undefined' && typeof app.updateBookingsList === 'function') {
    app.updateBookingsList();
  }
});

// If booking created from another tab/window, update on storage change
window.addEventListener('storage', (e) => {
  if (e.key === 'movieBookings' || e.key === 'bookings') {
    if (typeof loadBookings === 'function') loadBookings();
    else if (typeof app !== 'undefined' && typeof app.updateBookingsList === 'function') app.updateBookingsList();
  }
});


    // Mobile menu toggle
    if (hamburger) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
        });
    }

   // Smooth scrolling for navigation links
navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');

        // Agar dusre HTML page ka link hai to default allow karo
        if (href.endsWith('.html')) {
            return; // yaha se exit, redirect hoga normally
        }

        // Agar same page section (#id) link hai to smooth scroll
        if (href.startsWith('#')) {
            e.preventDefault();
            const targetSection = document.querySelector(href);
            if (targetSection) {
                targetSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        }

        // Close mobile menu
        if (hamburger && navMenu) {
            hamburger.classList.remove('active');
            navMenu.classList.remove('active');
        }
    });
});

// Update active navigation link on scroll
    window.addEventListener('scroll', () => {
        let current = '';
        const sections = document.querySelectorAll('section');
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop - 100;
            const sectionHeight = section.clientHeight;
            
            if (window.scrollY >= sectionTop && window.scrollY < sectionTop + sectionHeight) {
                current = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${current}`) {
                link.classList.add('active');
            }
        });
    });

    // Load movies
    loadMovies();

    // Contact form handling
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', handleContactForm);
    }
    
});

// Load and display movies
function loadMovies() {
    const moviesGrid = document.getElementById('moviesGrid');
    if (!moviesGrid) return;

    moviesGrid.innerHTML = '';
    
    movies.forEach(movie => {
        const movieCard = createMovieCard(movie);
        moviesGrid.appendChild(movieCard);
    });
}

// Create movie card element
function createMovieCard(movie) {
  const card = document.createElement('div');
  card.className = 'movie-card';
  card.setAttribute('data-movie-id', movie.id);
  let ratingStyle = "background: yellow; color: black;";

  if (movie.title === "Joker 2") {
    ratingStyle = "background: red; color: white;";
  }


  card.innerHTML = `
    <div class="movie-poster clickable" data-id="${movie.id}" style="background-image:url('${movie.poster}')">
     <div class="movie-rating" style="${ratingStyle}">★ ${movie.rating}</div>
      <span class="play-badge">►</span>
    </div>

    <div class="movie-content">
      <div class="movie-head">
        <h3 class="movie-title">${movie.title}</h3>
        <p class="movie-genre"><strong>Genre:</strong> ${movie.genre}</p>
        <p class="movie-duration">🕐 ${movie.duration}</p>
      </div>

      <p class="movie-description">${movie.description}</p>

      <div class="movie-footer">
        <p class="movie-language"><strong>Language:</strong> ${movie.language || 'Not Set'}</p>
        <p class="movie-price"><strong>Base Price:</strong> ${movie.basePrice ? `$${movie.basePrice}` : '$Not Set'}</p>
        <button class="book-now-btn">Book Now</button>
      </div>
    </div>
  `;

  // 👇 Add yeh listener
  card.addEventListener('click', (e) => {
    // Agar trailer poster ya play-badge click hua to booking pe na bhejo
    if (e.target.closest('.movie-poster')) return;
    if (e.target.classList.contains('play-badge')) return;

    bookMovie(movie.id);
  });

  // Book now button ke liye separately
  card.querySelector('.book-now-btn').addEventListener('click', (e) => {
    e.stopPropagation(); // card click na trigger ho
    bookMovie(movie.id);
  });

  return card;
}
// Load YouTube Iframe API once
let YT_API_READY = false;
let YT_API_LOADING = false;
function ensureYouTubeAPI(cb) {
  if (YT_API_READY) return cb();
  if (!YT_API_LOADING) {
    YT_API_LOADING = true;
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => { YT_API_READY = true; cb(); };
  } else {
    // wait-poll till ready
    const t = setInterval(() => {
      if (YT_API_READY) { clearInterval(t); cb(); }
    }, 50);
  }
}


function openTrailerModal(movie) {
  const modal  = document.getElementById('ticketModal');
  const body   = document.getElementById('ticketModalBody');
  const closer = document.getElementById('modalClose');
  if (!modal || !body) return;

  const isYouTube = movie.trailer && movie.trailer.includes('youtube.com/');
  let html = '';

  if (isYouTube) {
    // extract videoId from an embed url like .../embed/VIDEOID
    const idMatch = movie.trailer.match(/\/embed\/([^?&]+)/);
    const videoId = idMatch ? idMatch[1] : null;

    html = `
      <div id="ytWrap" style="position:relative; aspect-ratio:16/9; max-width:900px; width:min(90vw,900px);">
        <div id="ytPlayer"></div>
        <button id="ytUnmuteBtn"
          style="
            position:absolute; inset:auto 16px 16px auto;
            padding:10px 14px; border-radius:999px; border:none;
            background:#111; color:#fff; font-weight:600; cursor:pointer;
            box-shadow:0 6px 20px rgba(0,0,0,.35); opacity:.95;
          ">🔊 Tap for sound</button>
      </div>
    `;

    body.innerHTML = html;
    modal.classList.add('trailer');
    modal.style.display = 'flex';

    ensureYouTubeAPI(() => {
      // create player muted+autoplay
      const player = new YT.Player('ytPlayer', {
        videoId: videoId, // falls back to null -> no player
        playerVars: {
          autoplay: 1,
          mute: 1,          // start muted (autoplay allowed)
          rel: 0,
          playsinline: 1,
          modestbranding: 1
        },
        events: {
          onReady: (e) => { try { e.target.playVideo(); } catch(_){}; }
        }
      });

      // Unmute on user gesture
      const unmuteBtn = document.getElementById('ytUnmuteBtn');
      if (unmuteBtn) {
        unmuteBtn.addEventListener('click', () => {
          try {
            player.unMute();
            player.setVolume(100);
            player.playVideo();
          } catch(_) {}
          unmuteBtn.style.display = 'none';
        });
      }
    });

  } else if (movie.trailer) {
    // Native MP4: try play with sound; if blocked, show tap-to-play overlay
    html = `
      <div id="vidWrap" style="position:relative; max-width:900px; width:min(90vw,900px);">
        <video id="modalVideo" src="${movie.trailer}" controls autoplay playsinline
               style="width:100%; border-radius:12px;"></video>
        <button id="vidUnmuteBtn"
          style="
            position:absolute; inset:auto 16px 16px auto;
            padding:10px 14px; border-radius:999px; border:none;
            background:#111; color:#fff; font-weight:600; cursor:pointer;
            box-shadow:0 6px 20px rgba(0,0,0,.35); display:none;
          ">🔊 Tap for sound</button>
      </div>`;
    body.innerHTML = html;
    modal.classList.add('trailer');
    modal.style.display = 'flex';

    const v = document.getElementById('modalVideo');
    const btn = document.getElementById('vidUnmuteBtn');

    // try play with sound
    v.muted = false;
    const p = v.play();
    if (p && p.catch) {
      p.catch(() => {
        // autoplay with sound blocked -> show helper button
        btn.style.display = 'inline-block';
      });
    }
    btn?.addEventListener('click', () => {
      v.muted = false;
      v.play().catch(()=>{});
      btn.style.display = 'none';
    });

  } else {
    body.innerHTML = `<p style="color:#fff">Trailer not available.</p>`;
    modal.style.display = 'flex';
  }

  function closeAll() {
    modal.style.display = 'none';
    body.innerHTML = '';
    modal.classList.remove('trailer');
    closer?.removeEventListener('click', closeAll);
    window.removeEventListener('click', backdropClose);
  }
  function backdropClose(e){ if (e.target === modal) closeAll(); }
  closer?.addEventListener('click', closeAll);
  window.addEventListener('click', backdropClose);
}

document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('moviesGrid');
  if (!grid) return;

  grid.addEventListener('click', (e) => {
    const poster = e.target.closest('.movie-poster.clickable');
    if (!poster) return;

    const id = +poster.dataset.id;
    const movie = movies.find(m => m.id === id);
    if (movie && movie.trailer) {
      openTrailerModal(movie);
    }
  });
});

document.addEventListener('DOMContentLoaded', () => {
  const theaterCards = document.querySelectorAll('.theater-card[data-trailer]');

  theaterCards.forEach(card => {
    const trailer = card.dataset.trailer?.trim();
    if (!trailer) return;

    const imgBox = card.querySelector('.theater-image');
    if (!imgBox) return;

    // Inject yellow play-badge agar nahi hai
    if (!imgBox.querySelector('.play-badge')) {
      const badge = document.createElement('span');
      badge.className = 'play-badge';
      badge.textContent = '►';
      imgBox.appendChild(badge);
    }

    // Click pe modal khol
    imgBox.addEventListener('click', () => {
      openTrailerModal({ trailer: trailer });
    });
  });
});




// Book movie function
function bookMovie(movieId) {
    const selectedMovie = movies.find(movie => movie.id === movieId);
    if (selectedMovie) {
        // index ke liye original poster, booking ke liye thumb
        const movieForBooking = {
            ...selectedMovie,
            displayPoster: selectedMovie.posterThumb || selectedMovie.poster
        };

        localStorage.setItem('selectedMovie', JSON.stringify(movieForBooking));
        window.location.href = 'booking.html';
    }
}

// Contact form handler
function handleContactForm(e) {
  e.preventDefault();

  const form = e.target;
  const btn  = form.querySelector('button[type="submit"]');
  const fd   = new FormData(form);

  const name    = (fd.get('name') || 'Guest').trim();
  const email   = (fd.get('email') || '').trim();
  const message = (fd.get('message') || '').trim();

  // 1) validate
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailOk || !message) {
    openToast(
      `<h2>Please fill out the required fields</h2>
       <p>${emailOk ? '' : 'Valid email required.'} ${message ? '' : 'Message is required.'}</p>`
    );
    return;
  }

  // 2) disable button while "sending"
  const oldText = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }

  // TODO: real API call here — replace the setTimeout with fetch(...)
  setTimeout(() => {
    openToast(
      `<h2 style="margin:0 0 8px">Thank you, ${name}!</h2>
       <p>Your message has been sent. We'll get back to you soon.</p>`
    );
    form.reset();
    if (btn) { btn.disabled = false; btn.textContent = oldText || 'Send'; }
  }, 700);
}



// Navbar scroll effect
window.addEventListener('scroll', () => {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 50) {
        navbar.style.background = 'rgba(10, 10, 10, 0.98)';
    } else {
        navbar.style.background = 'rgba(10, 10, 10, 0.95)';
    }
});

// Add loading animation to movie cards
function animateMovieCards() {
    const movieCards = document.querySelectorAll('.movie-card');
    movieCards.forEach((card, index) => {
        card.style.animationDelay = `${index * 0.1}s`;
    });
}

// Initialize animations when page loads
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(animateMovieCards, 100);
});

// Add intersection observer for animations
if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, { threshold: 0.1 });

    document.addEventListener('DOMContentLoaded', () => {
        const animatedElements = document.querySelectorAll('.movie-card, .theater-card, .stat');
        animatedElements.forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(30px)';
            el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            observer.observe(el);
        });
    });
}

document.addEventListener("DOMContentLoaded", () => {
  const offersLink = document.getElementById("offers-link");
  const reviewsLink = document.getElementById("reviews-link");
  const offersSection = document.getElementById("offers-section");
  const reviewsSection = document.getElementById("reviews-section");

  if (offersLink && reviewsLink && offersSection && reviewsSection) {
    offersLink.addEventListener("click", (e) => {
      e.preventDefault();
      offersSection.classList.remove("hidden-section");
      reviewsSection.classList.add("hidden-section");
    });

    reviewsLink.addEventListener("click", (e) => {
      e.preventDefault();
      reviewsSection.classList.remove("hidden-section");
      offersSection.classList.add("hidden-section");
    });
  }
});

// -------- Review form: custom toast validation ----------
document.addEventListener('DOMContentLoaded', () => {
  const reviewForm = document.getElementById('reviewForm');
  const nameEl     = document.getElementById('reviewName');
  const textEl     = document.getElementById('reviewText');

  const modal  = document.getElementById('ticketModal');
  const body   = document.getElementById('ticketModalBody');
  const closer = document.getElementById('modalClose');

  // helper: sirf spaces ko bhi empty mano
  const isBlank = (s) => !s || !String(s).replace(/\s/g, '').length;



  if (reviewForm) {
    // pehle ke kisi listener ko double attach se bachao
    if (reviewForm.dataset.bound === '1') return;
    reviewForm.dataset.bound = '1';

   reviewForm.addEventListener('submit', (e) => {
  e.preventDefault();
  e.stopPropagation();

  const name = (nameEl?.value || '').trim();
  const text = (textEl?.value || '').trim();

  if (!name) {
    openToast(`<h2>Please fill out this field.</h2><p>Enter your name.</p>`);
    nameEl?.focus();
    return false;
  }
  if (!REVIEW_RATING || REVIEW_RATING < 1) {
    openToast(`<h2>Please select a star rating ⭐</h2>`);
    return false;
  }
  if (!text) {
    openToast(`<h2>Please fill out this field.</h2><p>Write your review.</p>`);
    textEl?.focus();
    return false;
  }

  openToast(`<h2>Thank you, ${name}!</h2><p>Your review has been submitted.</p>`);
  reviewForm.reset();
  REVIEW_RATING = 0;
  initReviewStars(); // reset stars

   // ✅ reset hint (remove show class)
  const hint = document.querySelector('.review-form .rating-hint');
  if (hint) hint.classList.remove('show');

  return false;
});
  }
});

  enhanceDateInputs();



const newsletterForm = document.getElementById("newsletterForm");
if (newsletterForm) {
  newsletterForm.addEventListener("submit", function(e) {
    e.preventDefault();
    const emailInput = document.getElementById("newsletterEmail");
    const email = emailInput ? emailInput.value.trim() : '';

    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!isValid) {
      openToast(`<h2>Invalid email</h2><p>Please enter a valid email address.</p>`);
      emailInput?.focus();
      return;
    }

    // TODO: API call here if needed

    openToast(`<h2>Subscribed!</h2><p>Thanks, <strong>${email}</strong>. You'll receive our latest updates.</p>`);
    if (emailInput) emailInput.value = "";
  });
}



document.addEventListener("DOMContentLoaded", () => {
    const fadeElements = document.querySelectorAll('.fade-in');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');

                const counters = entry.target.querySelectorAll('h3[data-target]');
                counters.forEach(counter => {
                    const target = +counter.getAttribute('data-target');
                    const suffix = counter.getAttribute('data-suffix') || "";
                    const duration = 2000; 
                    const stepTime = Math.max(Math.floor(duration / target), 20);
                    let count = 0;

                    const timer = setInterval(() => {
                        count++;
                        counter.textContent = count + suffix;
                        if (count >= target) {
                            clearInterval(timer);
                            counter.textContent = target + suffix;
                        }
                    }, stepTime);
                });

                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.3 });

    fadeElements.forEach(el => observer.observe(el));
});

/* ----------------- Clean, defensive bookings renderer + helpers ----------------- */

// Use existing helper that supports multiple keys
function getStoredBookings() {
  const raw = localStorage.getItem("bookings") || localStorage.getItem("movieBookings") || localStorage.getItem("movieBookingsList") || '[]';
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to parse bookings from storage', err);
    return [];
  }
}

function saveStoredBookings(bookings) {
  try {
    localStorage.setItem("bookings", JSON.stringify(bookings));
    localStorage.setItem("movieBookings", JSON.stringify(bookings));
  } catch (err) {
    console.warn('Could not save bookings to localStorage', err);
  }
}



// Helper: format date/time gracefully
function formatDateTime(dateVal, timeVal) {
  if (!dateVal && !timeVal) return 'Unknown Date';
  try {
    let combined = dateVal;
    if (timeVal && !/T/.test(String(dateVal))) combined = `${dateVal} ${timeVal}`;

    const d = new Date(combined);
    if (!isNaN(d.getTime())) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours === 0 ? 12 : hours;
      return `${yyyy}-${mm}-${dd} at ${hours}:${minutes} ${ampm}`;
    }
  } catch (e) { /* ignore */ }
  return [dateVal, timeVal].filter(Boolean).join(' ');
}


// Unified renderer into #bookingsContainer (safe and defensive)
function loadBookings() {
  const bookingsContainer = document.getElementById("bookingsContainer") || document.getElementById("bookingsList");
  if (!bookingsContainer) {
    return;
  }

  const bookings = getStoredBookings();

  if (!bookings || bookings.length === 0) {
  bookingsContainer.innerHTML = `
    <div class="no-bookings">
      <h2>No bookings yet</h2>
      <p>Your movie bookings will appear here</p>
    </div>
  `;
  return;
}


  bookingsContainer.innerHTML = "";

  bookings.forEach((booking, idx) => {
    // Normalize movie title
    let movieName = 'Untitled Movie';
    if (booking) {
      if (typeof booking.movie === 'string') movieName = booking.movie;
      else if (typeof booking.movie === 'object' && booking.movie !== null) {
        movieName = booking.movie.title || booking.movie.name || booking.movie.movie || movieName;
      } else {
        movieName = booking.title || booking.name || movieName;
      }
    }
    // Prefer saved pretty string ($56.07). Fallback: format numeric total in USD.
const totalDisplay =
  (typeof booking.totalFormatted === 'string' && booking.totalFormatted)
    ? booking.totalFormatted
    : formatMoneyUSD(total);


    // Fields
    const poster = booking.poster || booking.displayPoster || booking.posterThumb || FALLBACK_POSTER;
    const theater = booking.theater || booking.venue || 'Unknown Theater';
    const dateStr = booking.date || booking.showDate || booking.showDateTime || '';
    const timeStr = booking.time || booking.showTime || '';
    const formattedDate = formatDateTime(dateStr, timeStr);

    const seatsArr = Array.isArray(booking.seats) ? booking.seats : (booking.seats ? String(booking.seats).split(',').map(s => s.trim()) : []);
    const seatsText = seatsArr.length ? seatsArr.join(', ') : (booking.seats || 'N/A');

    const snacksText = booking.snacks && booking.snacks.length ? booking.snacks.join(', ') : (booking.snacks ? String(booking.snacks) : 'None');

   

    // Status handling
    let statusRaw = booking.status ?? booking.state ?? booking.statusText ?? 'CONFIRMED';
    let status = String(statusRaw).toUpperCase();
    if (status === 'TRUE' || status === '1') status = 'CONFIRMED';
    if (status === 'FALSE' || status === '0') status = 'CANCELLED';

    const id = booking.id ?? booking.bookingId ?? idx;

    // Build card
    const card = document.createElement('div');
    card.className = 'booking-card compact';

    card.innerHTML = `
      <img src="${poster}" alt="${movieName}" class="booking-poster thumb" onerror="if(!this.dataset._fallback){ this.dataset._fallback=1; this.src='${FALLBACK_POSTER}'; }">

      <div class="booking-main">
        <h4 class="booking-title">${movieName}</h4>

        <div class="booking-meta">
          <div class="meta-line date-line"><strong>Date:</strong> ${formattedDate}</div>
          <div class="meta-line"><strong>Theater:</strong> ${theater}</div>
          <div class="meta-line"><strong>Seats:</strong> ${seatsText}</div>
          <div class="meta-line"><strong>Total:</strong> ${totalDisplay}</div>
          <div class="meta-line"><strong>Snacks:</strong> ${snacksText}</div>
          <div class="meta-line booking-status-line"><strong>Status:</strong> <span class="booking-status">${status}</span></div>
        </div>
      </div>

      <div class="booking-controls">
        <button class="btn-view" data-id="${id}">View Ticket</button>
        <button class="btn-cancel" data-id="${id}">Cancel</button>
      </div>
    `;

    if (status === 'CANCELLED') card.classList.add('cancelled');

    // ensure card is positioned relative so absolute children can use it
    card.style.position = 'relative';

    bookingsContainer.appendChild(card);

    // Position controls so "View Ticket" aligns with Date line
    requestAnimationFrame(() => {
      const dateEl = card.querySelector('.meta-line.date-line');
      const controls = card.querySelector('.booking-controls');
      if (!dateEl || !controls) return;

      const dateRect = dateEl.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();

      const top = dateRect.top - cardRect.top + (dateEl.offsetHeight - controls.offsetHeight) / 2;

      if (card.clientWidth < 500) {
        // mobile fallback: keep normal flow
        controls.style.position = '';
        controls.style.right = '';
        controls.style.top = '';
        controls.style.display = '';
        controls.style.flexDirection = '';
        controls.style.gap = '';
        controls.style.alignItems = '';
        controls.style.marginTop = '12px';
      } else {
        controls.style.position = 'absolute';
        controls.style.right = '18px';
        controls.style.top = Math.max(6, Math.round(top)) + 'px';
        controls.style.display = 'flex';
        controls.style.flexDirection = 'column';
        controls.style.gap = '6px';
        controls.style.alignItems = 'flex-end';
      }
    });
  }); // end forEach

  // attach handlers once after rendering all bookings
  attachBookingActionHandlers(bookingsContainer);
}


// Attach click handlers (idempotent — won't attach twice)
function attachBookingActionHandlers(containerEl) {
  const container = containerEl || document.getElementById("bookingsContainer") || document.getElementById("bookingsList");
  if (!container) return;

  container.querySelectorAll('.btn-view').forEach(btn => {
    if (btn.dataset.handlerAttached) return;
    btn.dataset.handlerAttached = '1';
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      if (id === undefined) return;
      // store which booking to view and redirect - booking.html should read viewBookingId
      localStorage.setItem('viewBookingId', String(id));
      // if you have a dedicated booking viewer page
      window.location.href = 'booking.html';
    });
  });

container.querySelectorAll('.btn-cancel').forEach(btn => {
  if (btn.dataset.cancelAttached) return;
  btn.dataset.cancelAttached = '1';
  btn.addEventListener('click', (e) => {
    const id = e.currentTarget.dataset.id;
    if (id === undefined) return;
    showCancelConfirm(id);   // ✅ custom modal
  });
});

}



function showCancelConfirm(id) {
  const modal  = document.getElementById('ticketModal');
  const body   = document.getElementById('ticketModalBody');
  const closer = document.getElementById('modalClose');
  if (!modal || !body) return;

  // Toast style content
  body.innerHTML = `
    <h2 style="margin:0 0 8px">Cancel Booking?</h2>
    <p>Are you sure you want to cancel this booking?</p>
    <div style="margin-top:16px; display:flex; gap:12px; justify-content:flex-end;">
     <button id="cancelYes"
        style="padding:8px 14px; border-radius:6px; border:none; background:#e74c3c; color:#fff; cursor:pointer;">
        Yes
      </button>  
    <button id="cancelNo"
        style="padding:8px 14px; border-radius:6px; border:none; background:#444; color:#fff; cursor:pointer;">
        No
      </button>
     
    </div>
  `;

  modal.classList.remove('trailer');
  modal.classList.add('toast');
  modal.style.display = 'flex';
  lockScroll();

  function closeAll() {
    modal.style.display = 'none';
    body.innerHTML = '';
    modal.classList.remove('toast');
    unlockScroll();
    closer?.removeEventListener('click', closeAll);
    window.removeEventListener('click', backdropClose);
  }
  function backdropClose(e){ if (e.target === modal) closeAll(); }

  closer?.addEventListener('click', closeAll);
  window.addEventListener('click', backdropClose);

  document.getElementById('cancelNo')?.addEventListener('click', closeAll);
  document.getElementById('cancelYes')?.addEventListener('click', () => {
    let list = getStoredBookings();
    const before = list.length;

    list = list.filter(b => {
      const bid = (b.id ?? b.bookingId ?? '').toString();
      return bid !== String(id);
    });

    // Optional: agar id nahi mila to bhi graceful close
    if (list.length === before) {
      openToast(`<h2>Not found</h2><p>Could not find that booking to cancel.</p>`);
      return;
    }

    saveStoredBookings(list);
    loadBookings();
    window.dispatchEvent(new CustomEvent('bookingsUpdated', { detail: { id } }));
    closeAll();
    openToast(`<h2>Cancelled</h2><p>Your booking has been cancelled.</p>`);
  });
}




function formatMoneyUSD(val) {
  if (val === undefined || val === null || val === '—') return '—';

  // If it's already a formatted string with a currency symbol, just show it
  if (typeof val === 'string' && /[$€£₹]/.test(val)) return val;

  const num = (typeof val === 'number')
    ? val
    : parseFloat(String(val).replace(/[^0-9.-]+/g, ''));
  if (isNaN(num)) return '—';

  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
}



// Single canonical initial load — call once after DOM ready
document.addEventListener("DOMContentLoaded", () => {
  loadBookings();
});


// --------- Scroll Lock Helpers ---------
function lockScroll() {
  // compensate for scrollbar to avoid layout shift
  const comp = window.innerWidth - document.documentElement.clientWidth;
  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';
  if (comp > 0) document.body.style.paddingRight = comp + 'px';
}

function unlockScroll() {
  document.documentElement.style.overflow = '';
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
}



function initReviewStars() {
  const wrap = document.querySelector('.review-form .star-input');
  if (!wrap) return;
  wrap.innerHTML = '';      // ❗ ensure NO extra nodes

  // ✅ remove old hint if exists
  const oldHint = wrap.parentNode.querySelector('.rating-hint');
  if (oldHint) oldHint.remove();

  for (let i = 1; i <= 5; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'star';
    b.dataset.val = i;
    b.textContent = '★';
    wrap.appendChild(b);
  }

  // fresh hint
  let hint = document.createElement('small');
  hint.className = 'rating-hint';
  hint.textContent = "Thanks! Write a review to leave more feedback.";
  wrap.after(hint);

  const paint = (val) => {
    wrap.querySelectorAll('.star').forEach((s, idx) => {
      s.classList.toggle('active', idx < val);
    });
  };

  wrap.addEventListener('mouseover', (e) => {
    const btn = e.target.closest('.star');
    if (btn) paint(+btn.dataset.val);
  });

  wrap.addEventListener('mouseout', () => paint(REVIEW_RATING));

  wrap.addEventListener('click', (e) => {
    const btn = e.target.closest('.star');
    if (!btn) return;
    REVIEW_RATING = +btn.dataset.val;
    paint(REVIEW_RATING);
    wrap.nextElementSibling?.classList.add('show');
  });
}


