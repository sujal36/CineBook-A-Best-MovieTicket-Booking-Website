// Booking page functionality
let selectedTheater = null;
let selectedDate = null;
let selectedShowtime = null;
let selectedSeats = [];
let currentStep = 1;
let movieData = null;
let selectedPaymentMethod = 'card';
let seatPrices = {
    'regular': 15.99,
    'premium': 19.99,
    'vip': 24.99
};
let seatTotal = 0;
let snacksTotal = 0;
const snacksCart = new Map();
/* ---- Toast helper (same look as index) ---- */
function lockScroll() {
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

function openToast(html) {
  const modal  = document.getElementById('ticketModal');
  const body   = document.getElementById('ticketModalBody');
  const closer = document.getElementById('modalClose');

  // fallback agar modal na mila ho
  if (!modal || !body) { alert(html.replace(/<[^>]+>/g, '')); return; }

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
    unlockScroll();
    if (closer && closer.parentNode !== modal) modal.appendChild(closer);
    closer?.removeEventListener('click', closeAll);
    window.removeEventListener('click', backdropClose);
  }
  function backdropClose(e){ if (e.target === modal) closeAll(); }

  closer?.addEventListener('click', closeAll);
  window.addEventListener('click', backdropClose);
}

// --- Add this right after: const snacksCart = new Map(); ---
function safeGet(id) {
  return document.getElementById(id) || null;
}

// --- Coupon config (ADD here, right after snacksCart) ---
// ---------- COUPON: definitions + state ----------
// ---------- COUPON: definitions + state (paste right after `const snacksCart = new Map();`) ----------
let appliedCoupon = null; // { code: 'FAMILY4+1', amount: 12.00, meta: {...} }

const couponDefinitions = {
  "WEEKEND20": { type: "percent", value: 20, desc: "20% off on weekend bookings" },
  "STUDENT25": { type: "percent", value: 25, desc: "25% student discount" },
  "FAMILY4+1": { type: "buyxgety", x: 4, y: 1, desc: "Buy 4 get 1 free (free cheapest seat)" },
  "EARLY30": { type: "percent", value: 30, desc: "30% off on morning shows before 12 PM" },
  "EARLY120": { type: "fixed", value: 120, desc: "Flat 120 off (example fixed)" }
};

function showCouponMessage(msg, isError) {
  const el = safeGet('couponMessage');
  if (!el) return;
  el.textContent = msg || '';
  el.style.color = isError ? '#ff6b6b' : '#9fda5d';
}

function computeBuyXGetYDiscount(def) {
  // discount = price of cheapest selected seat * y (if enough seats selected)
  if (!selectedSeats || selectedSeats.length < def.x) return 0;
  const cheapest = selectedSeats.reduce((min, s) => Math.min(min, s.price || 0), Infinity);
  return (cheapest === Infinity) ? 0 : (cheapest * (def.y || 1));
}

function applyCouponHandler() {
  const input = safeGet('couponCodeInput');
  if (!input) return;
  const code = (input.value || '').trim().toUpperCase();
  if (!code) { showCouponMessage('Please enter a coupon code', true); return; }

  const def = couponDefinitions[code];
  if (!def) { showCouponMessage('Invalid coupon code', true); return; }

  // compute current totals
  const seatsTotal = selectedSeats.reduce((sum, s) => sum + (s.price || 0), 0);
  const snacksTotalCalc = [...snacksCart.values()].reduce((sum, it) => sum + (it.price * it.qty), 0);

  // special rule example for EARLY30: only morning shows before 12 PM
  if (def.type === 'percent' && code === 'EARLY30') {
    if (!selectedShowtime) { showCouponMessage('Select a showtime to use this coupon', true); return; }
    const m = selectedShowtime.match(/(\d{1,2}):?(\d{0,2})\s*(AM|PM)/i);
    if (m) {
      let hour = parseInt(m[1], 10);
      const ampm = (m[3] || '').toUpperCase();
      if (ampm === 'PM' && hour !== 12) hour += 12;
      if (ampm === 'AM' && hour === 12) hour = 0;
      if (hour >= 12) { showCouponMessage('EARLY30 only valid for morning shows before 12 PM', true); return; }
    }
  }

  let discount = 0;
  if (def.type === 'percent') {
    discount = (seatsTotal + snacksTotalCalc) * (def.value / 100);
  } else if (def.type === 'fixed') {
    discount = Number(def.value || 0);
  } else if (def.type === 'buyxgety') {
    if (!selectedSeats || selectedSeats.length < def.x) {
      showCouponMessage(`This coupon requires at least ${def.x} tickets`, true);
      return;
    }
    discount = computeBuyXGetYDiscount(def);
  }

  discount = Math.max(0, Number((discount || 0).toFixed(2)));
  appliedCoupon = { code, amount: discount, meta: def };

  showCouponMessage(`Applied ${code} — you saved ${formatCurrency(discount)}`, false);

  // toggle apply/remove UI (we'll hide apply and show remove)
  const applyBtn = safeGet('applyCouponBtn');
  const removeBtn = safeGet('removeCouponBtn');
  if (applyBtn) applyBtn.style.display = 'none';
  if (removeBtn) removeBtn.style.display = 'inline-block';

  updateBookingSummary();
}

function removeCouponHandler() {
  appliedCoupon = null;
  showCouponMessage('', false);
  const applyBtn = safeGet('applyCouponBtn');
  const removeBtn = safeGet('removeCouponBtn');
  if (applyBtn) applyBtn.style.display = 'inline-block';
  if (removeBtn) removeBtn.style.display = 'none';
  updateBookingSummary();
}




// ---------- ADD: seat categories mapping (paste after seatPrices) ----------
const seatCategories = {
  vip:     { rows: ['A','B','C'], price: seatPrices.vip },
  premium: { rows: ['D','E','F'], price: seatPrices.premium },
  regular: { rows: ['G','H','I','J'], price: seatPrices.regular }
};

// -------------------------------------------------------------------------


// Initialize booking page
// Initialize booking page
document.addEventListener('DOMContentLoaded', function () {
    // Load movie data from localStorage
    const storedMovie = localStorage.getItem('selectedMovie');
    const viewBookingId = localStorage.getItem('viewBookingId');

    if (storedMovie) {
        movieData = JSON.parse(storedMovie);
        displayMovieInfo(movieData);
    } else if (viewBookingId) {
        // page opened for viewing an existing booking (from index "View" button)
        // don't redirect back to index — booking.js will show the modal later when we load booking
        movieData = null;
    } else {
        // Redirect back to main page if no movie selected and not a view request
        window.location.href = 'index.html';
        return;
    }

    // Initialize event listeners
    initializeEventListeners();

    // Generate seating chart
    generateSeatingChart();

    // Set up form validation
    setupFormValidation();

    // Initialize payment methods
    initializePaymentMethods();
  



    // book/cancel handlers
const bookBtn = document.getElementById("bookTicketsBtn");
const bookingPage = document.getElementById("bookingPage");
const cancelBtn = document.getElementById("cancelBtn");
const movieActions = document.querySelector(".movie-actions");

if (bookingPage) bookingPage.style.display = "none";
if (bookBtn) bookBtn.addEventListener("click", () => {
    if (bookingPage) bookingPage.style.display = "block";
    if (movieActions) movieActions.style.display = "none";
    goToStep(1);
});
if (cancelBtn) cancelBtn.addEventListener("click", () => {
    // hide booking panel, show movie actions
    if (bookingPage) bookingPage.style.display = "none";
    if (movieActions) movieActions.style.display = "flex";

    // === RESET EVERYTHING ===
    selectedTheater = null;
    selectedDate = null;
    selectedShowtime = null;
    resetSeatSelection();

    // reset UI highlights
    document.querySelectorAll('.theater-option').forEach(o => o.classList.remove('active'));
    document.querySelectorAll('.theater-schedule').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.showtime-btn').forEach(b => b.classList.remove('selected'));
    document.querySelectorAll('.date-picker').forEach(inp => inp.value = '');

    // disable next button again
    const nextBtn = document.getElementById('nextToSeats');
    if (nextBtn) nextBtn.disabled = true;

    // regenerate fresh seating chart (clears any old seat DOM state)
    generateSeatingChart();
});


});

// Navigation between steps
function goToStep(step) {
  document.querySelectorAll('.booking-step').forEach(stepEl => {
    stepEl.classList.remove('active');
    // hide but keep transitions safe
    stepEl.style.display = 'none';
    stepEl.style.opacity = '0';
    stepEl.style.visibility = 'hidden';
  });
  document.querySelectorAll('.step').forEach(stepEl => stepEl.classList.remove('active'));

  const panel = document.getElementById(`step${step}`);
  const indicator = document.querySelector(`[data-step="${step}"]`);
  if (panel) {
    panel.classList.add('active');
    panel.style.display = 'block';
    // small delay for transition (if any)
    requestAnimationFrame(() => {
      panel.style.opacity = '1';
      panel.style.visibility = 'visible';
    });
  }
  if (indicator) indicator.classList.add('active');

  currentStep = step;

  if (step === 4) updateBookingSummary();
}



function displayMovieInfo(movie) {
    const movieInfoContainer = document.getElementById('movieInfo');
    const posterImg = movie.posterThumb || movie.poster;

    // single-line info: Rating | Duration | Genre (if available)
    const fullInfo = `${movie.rating || "N/A"}${movie.duration ? " | " + movie.duration : ""}${movie.genre ? " | " + movie.genre : ""}`;

    movieInfoContainer.innerHTML = `
        <!-- Poster + Info (side-by-side layout, no outer big box) -->
        <div class="movie-info-row">
            <!-- Poster (left) -->
            <div class="movie-poster-box">
                <img src="${posterImg}" alt="${movie.title}">
            </div>

            <!-- Info (right) -->
            <div class="movie-info-content">
                <h1 class="movie-title">${movie.title}</h1>

                <!-- Info row: PG | Duration | Genre  +  IMDb Btn -->
                <div class="info-row">
                    <span class="info-tag">${fullInfo}</span>
                    ${movie.imdbLink ? `
        <a href="${movie.imdbLink}" target="_blank" class="imdb-btn" style="margin-left:24px;">
            Read IMDb Reviews
        </a>
    ` : ""}
                </div>

                ${movie.description ? `
                    <div class="movie-desc-block">
                        <h3>Description</h3>
                        <p>${movie.description}</p>
                    </div>
                ` : ""}
            </div>
        </div>

        <!-- Cast & Director (unchanged structure below) -->
        <div class="movie-details">
            <!-- Cast Section -->
            <div class="info-block">
                <h3>Cast</h3>
                <div class="cast-list">
                    ${movie.cast ? movie.cast.map(actor => `
                        <div class="cast-member">
                            <img src="${actor.image || 'images/default-profile.jpg'}" alt="${actor.name}">
                            <a href="${actor.link || '#'}" target="_blank" class="name">${actor.name}</a>
                            <div class="role">${actor.role || ""}</div>
                        </div>
                    `).join("") : "Not Available"}
                </div>
            </div>

            <!-- Director Section -->
            <div class="info-block">
                <h3>Director</h3>
                <div class="cast-list">
                    <div class="cast-member">
                        <img src="${movie.director?.image || 'images/default-profile.jpg'}" alt="${movie.director?.name || 'Director'}">
                        <a href="${movie.director?.link || '#'}" target="_blank" class="name">${movie.director?.name || "Not Available"}</a>
                        <div class="role"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// REPLACE your old checkNextButton() with this exact function
function checkNextButton() {
  const nextBtn = document.getElementById('nextToSeats'); // <-- correct id from your HTML
  if (!nextBtn) return;

  // ensure all three selected (theater, date, showtime)
  if (selectedTheater && selectedDate && selectedShowtime) {
    nextBtn.disabled = false;      // enable
    nextBtn.classList.remove('disabled'); // optional: if you style .disabled in CSS
  } else {
    nextBtn.disabled = true;       // disable
    nextBtn.classList.add('disabled'); // optional
  }


}

// Enable/disable showtimes INSIDE a theater card
function setShowtimesEnabled(cardEl, enabled) {
  if (!cardEl) return;
  cardEl.querySelectorAll('.showtime-btn').forEach(btn => {
    if (enabled) {
      btn.classList.remove('is-disabled');
      btn.disabled = false; // (safe even if your CSS ignores it)
    } else {
      btn.classList.remove('selected');
      btn.classList.add('is-disabled');
      btn.disabled = true;
    }
  });
}





// Initialize all event listeners
function initializeEventListeners() {
    // Step navigation buttons
    const nextToSeatsBtn = document.getElementById('nextToSeats');
    if (nextToSeatsBtn) nextToSeatsBtn.addEventListener('click', () => goToStep(2));

    const backToShowtimeBtn = document.getElementById('backToShowtime');
    if (backToShowtimeBtn) backToShowtimeBtn.addEventListener('click', () => {
  resetSeatSelection();      // optional immediate clear on back
  goToStep(1);
});


    // Seats -> Snacks (id: nextToSnacks). Fallback to older nextToPayment if present.
    const nextToSnacksBtn = document.getElementById('nextToSnacks') || document.getElementById('nextToPayment');
    if (nextToSnacksBtn) nextToSnacksBtn.addEventListener('click', () => {
  if (selectedSeats.length === 0) {
    openToast('<h2>Please select at least one seat.</h2>');
    return;
  }
  goToStep(3);
});


    // Back from Snacks -> Seats (support both ids)
    const backToSeatsFromSnacks = document.getElementById('backToSeatsFromSnacks') || document.getElementById('backToSeats');
    if (backToSeatsFromSnacks) backToSeatsFromSnacks.addEventListener('click', () => goToStep(2));

    // Snacks -> Payment (Step 4)
    const nextToPaymentSnacks = document.getElementById('nextToPaymentSnacks') || document.getElementById('nextToPaymentFinal');
    if (nextToPaymentSnacks) nextToPaymentSnacks.addEventListener('click', () => goToStep(4));

    // Payment -> back to Snacks
    const backToSnacksBtn = document.getElementById('backToSnacks') || document.querySelector('#step4 #backToSeats');
    if (backToSnacksBtn) backToSnacksBtn.addEventListener('click', () => goToStep(3));

    // Confirm booking
    const confirmBtn = document.getElementById('confirmBooking');
    if (confirmBtn) confirmBtn.addEventListener('click', confirmBooking);

    // Cancel booking → redirect to home
const cancelBookingBtn = document.getElementById('cancelBooking');
if (cancelBookingBtn) {
  cancelBookingBtn.addEventListener('click', () => {
    window.location.href = 'index.html'; // 👈 sidha home redirect
  });
}

    // Modal buttons
    

    // --- Move/keep your theater + schedule listeners here (so all listeners initialized together) ---
    // If you already had the block starting with document.querySelectorAll('.theater-option') outside,
    // cut/paste that block inside this function (to avoid duplicate listeners).
}

    // --- Theater + schedule listeners (put inside initializeEventListeners) ---
    document.querySelectorAll('.theater-option').forEach(option => {
      option.addEventListener('click', (e) => {
  // agar schedule ke andar kahin bhi click hua (label, h4, input, btn), to parent collapse NA ho
  if (e.target.closest('.theater-schedule')) return;

  document.querySelectorAll('.theater-option').forEach(o => o.classList.remove('active'));
  document.querySelectorAll('.theater-schedule').forEach(s => s.style.display = 'none');

  option.classList.add('active');
  selectedTheater = option.dataset.theater;

  const sched = option.querySelector('.theater-schedule');
  if (sched) sched.style.display = 'block';

  // reset for naye card
  selectedDate = null;
  selectedShowtime = null;
  option.querySelectorAll('.showtime-btn').forEach(b => b.classList.remove('selected'));
  const dateInput = option.querySelector('.date-picker');
  if (dateInput) dateInput.value = '';

  // ⬇️ disable all showtimes until a date is picked
setShowtimesEnabled(option, false);
  // === INSERT on theater change ===
  resetSeatSelection();
  generateSeatingChart();
  document.getElementById('nextToSeats').disabled = true;
});

    });

    // delegated showtime clicks (works for buttons inside any theater card)
    document.addEventListener('click', function(e) {
      if (!e.target.classList.contains('showtime-btn')) return;
      const btn = e.target;
      const parentCard = btn.closest('.theater-option');
      if (!parentCard) return;

      // clear selected showtime inside this card, then mark clicked
      parentCard.querySelectorAll('.showtime-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');

      selectedShowtime = btn.dataset.time;
      checkNextButton();
        // === INSERT on showtime change (listener #1) ===
  resetSeatSelection();
  generateSeatingChart();

    });

    // date input change (works for flatpickr or normal input)
   document.addEventListener('change', function(e) {
  if (!e.target.classList.contains('date-picker')) return;
  selectedDate = e.target.value;
  // ⬇️ enable showtimes for this theater card only
  const card = e.target.closest('.theater-option');
  setShowtimesEnabled(card, !!selectedDate);
  checkNextButton();
  // === INSERT on date change ===
  resetSeatSelection();
  generateSeatingChart();
});

    // --- end theater listeners ---


      // Coupon buttons (wire them here)
  const applyBtnEl = document.getElementById('applyCouponBtn');
  const removeBtnEl = document.getElementById('removeCouponBtn');
  const couponInputEl = document.getElementById('couponCodeInput');

  if (applyBtnEl) applyBtnEl.addEventListener('click', applyCouponHandler);
  if (removeBtnEl) removeBtnEl.addEventListener('click', removeCouponHandler);

  // Optional: allow Enter key in coupon input to apply
  if (couponInputEl) {
    couponInputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); applyCouponHandler(); }
    });
  }



        // initialize flatpickr AFTER event listeners are attached
    // initialize flatpickr AFTER listeners are attached
if (typeof flatpickr !== 'undefined') {
  // make sure inputs are readonly so caret/keyboard na aaye
  document.querySelectorAll('.date-picker').forEach(inp => {
    inp.setAttribute('readonly', 'readonly');
  });

  flatpickr('.date-picker', {
    disableMobile: true,
    minDate: 'today',
    dateFormat: 'd-m-Y',
    altInput: true,        // 👈 ek styled input dikhega
    altFormat: 'd M Y',
    allowInput: false,       // typing off
    clickOpens: true,
    onReady: (sel, str, fp) => {
      fp.input.setAttribute('readonly', 'readonly');
      if (fp.altInput) fp.altInput.setAttribute('readonly', 'readonly');
    },
    onChange: (selectedDates, dateStr, fp) => {
  selectedDate = dateStr || fp.input.value || '';
  // ⬇️ enable showtimes for this theater card only
  const card = fp.input.closest('.theater-option');
  setShowtimesEnabled(card, !!selectedDate);
  checkNextButton();


    // === INSERT inside flatpickr onChange ===
  resetSeatSelection();
  generateSeatingChart();

}
  });
}

document.addEventListener('click', function(e) {
  if (!e.target.classList.contains('showtime-btn')) return;
  e.stopPropagation(); // parent card click ko rok do
  const btn = e.target;
  const parentCard = btn.closest('.theater-option');
  if (!parentCard) return;

  parentCard.querySelectorAll('.showtime-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');

  selectedShowtime = btn.dataset.time || '';
  checkNextButton();

    // === INSERT on showtime change (listener #2) ===
  resetSeatSelection();
  generateSeatingChart();

});






// Initialize payment methods
function initializePaymentMethods() {
    const paymentOptions = document.querySelectorAll('.payment-option');
    const paymentSections = document.querySelectorAll('.payment-section');

    paymentOptions.forEach(option => {
        option.addEventListener('click', () => {
            // Remove active class from all options
            paymentOptions.forEach(opt => opt.classList.remove('active'));
            paymentSections.forEach(section => section.classList.remove('active'));

            // Add active class to selected option
            option.classList.add('active');
            selectedPaymentMethod = option.dataset.method;

            // Show corresponding payment section
            const targetSection = document.querySelector(`.${selectedPaymentMethod}-payment`);
            if (targetSection) {
                targetSection.classList.add('active');
            }

            // Update form validation requirements
            updateFormValidation();
        });
    });
}

// Update form validation based on payment method
function updateFormValidation() {
    const cardInputs = document.querySelectorAll('.card-payment input');
    const emailInput = document.getElementById('email');
    const phoneInput = document.getElementById('phone');

    // Reset all validation requirements
    cardInputs.forEach(input => {
        input.required = false;
    });

    // Set requirements based on payment method
    if (selectedPaymentMethod === 'card') {
        cardInputs.forEach(input => {
            input.required = true;
        });
    }

    // Email and phone are always required
    emailInput.required = true;
    phoneInput.required = true;
}

// ---------- REPLACE generateSeatingChart() with this ----------
function generateSeatingChart() {
    const seatingChart = document.getElementById('seatingChart');
    const rows = ['A','B','C','D','E','F','G','H','I','J'];
    const seatsPerRow = 12;

    seatingChart.innerHTML = '';

    rows.forEach((row, rowIndex) => {
        const seatRow = document.createElement('div');
        seatRow.className = 'seat-row';

        const rowLabel = document.createElement('div');
        rowLabel.className = 'row-label';
        rowLabel.textContent = row;
        seatRow.appendChild(rowLabel);

        const leftSeats = document.createElement('div');
        leftSeats.className = 'seats';
        const aisle = document.createElement('div');
        aisle.className = 'aisle';
        const rightSeats = document.createElement('div');
        rightSeats.className = 'seats';

        for (let seatNum = 1; seatNum <= seatsPerRow; seatNum++) {
            const seat = document.createElement('div');
            seat.className = 'seat';
            seat.dataset.row = row;
            seat.dataset.number = seatNum;
            seat.dataset.seatId = `${row}${seatNum}`;

            let seatType = 'regular';
            if (['A','B','C'].includes(row)) {
                seatType = 'vip';
                seat.classList.add('vip');
            } else if (['D','E','F'].includes(row)) {
                seatType = 'premium';
                seat.classList.add('premium');
            } else {
                seat.classList.add('regular');
            }

            const isOccupied = Math.random() < 0.1; // 10% occupied
            if (isOccupied) {
                // occupied/booked seats: ensure no selected class remains and no click handler
                seat.classList.add('occupied', 'booked');
                seat.classList.remove('available', 'selected');
                seat.removeAttribute('onclick');
                // optional: set title for UX
                seat.title = 'Occupied';
            } else {
                seat.classList.add('available');
                // attach click only for available seats
                seat.addEventListener('click', () => toggleSeat(seat, seatType));
            }

            seat.dataset.seatType = seatType;
            seat.textContent = seatNum;

            if (seatNum <= 6) leftSeats.appendChild(seat);
            else rightSeats.appendChild(seat);
        }

        seatRow.appendChild(leftSeats);
        seatRow.appendChild(aisle);
        seatRow.appendChild(rightSeats);

        seatingChart.appendChild(seatRow);
    });
}


// --- Snacks: add/remove/update UI ---
function addSnack(name, price) {
    if (!name) return;
    price = Number(price || 0);

    if (snacksCart.has(name)) {
        const existing = snacksCart.get(name);
        existing.qty += 1;
        snacksCart.set(name, existing);
    } else {
        snacksCart.set(name, { name, price, qty: 1 });
    }

    snacksTotal = [...snacksCart.values()].reduce((sum, it) => sum + (it.price * it.qty), 0);
    updateSnackUITexts();
}

function removeSnack(name) {
    if (!snacksCart.has(name)) return;
    const existing = snacksCart.get(name);
    existing.qty -= 1;
    if (existing.qty <= 0) snacksCart.delete(name);
    else snacksCart.set(name, existing);

    snacksTotal = [...snacksCart.values()].reduce((sum, it) => sum + (it.price * it.qty), 0);
    updateSnackUITexts();
}

function updateSnackUITexts() {
  const selectedSnacksText = safeGet('selectedSnacksText');
  if (selectedSnacksText) {
    const names = [...snacksCart.values()].map(it => `${it.name} x${it.qty}`);
    selectedSnacksText.textContent = names.length ? names.join(', ') : 'None';
  }

  const snacksTotalEl = safeGet('snacksTotal');
  if (snacksTotalEl) snacksTotalEl.textContent = formatCurrency(Number(snacksTotal || 0));

  if (document.getElementById('step4')?.style.display !== 'none' || currentStep === 4) {
    updateBookingSummary();
  }
}


/* -------------------------
   Snacks: card UI updater + click wiring
   Paste this right AFTER updateSnackUITexts()
--------------------------*/

function updateSnackCardQtyUI() {
  // for each .snack-card, read the <h4> title as the snack name and update qty-badge
  document.querySelectorAll('.snack-card').forEach(card => {
    const titleEl = card.querySelector('h4');
    if (!titleEl) return;
    const name = titleEl.textContent.trim();

    const qty = snacksCart.get(name)?.qty || 0;

    // create badge if not present
    let badge = card.querySelector('.qty-badge');

    // Ensure the card is a positioning context and clips overflow so badge stays inside rounded corners
    if (getComputedStyle(card).position === 'static') card.style.position = 'relative';
    // keep visual clipping (won't change layout)
    card.style.overflow = 'hidden';

    // Prefer to attach badge to the image wrapper if available so it's clearly inside the image area
    const img = card.querySelector('img');

    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'qty-badge';

      // minimal inline style so nothing else needed
      badge.style.position = 'absolute';
      // place the badge INSIDE the top-left corner of the image area
      badge.style.top = '16px';     // tweak +/- 1-3px if you want it a bit more inward
      badge.style.left = '16px';    // tweak +/- 1-3px
      badge.style.transform = 'none';
      badge.style.zIndex = '50';
      badge.style.pointerEvents = 'none';
      badge.style.display = 'none';
      badge.style.background = 'rgba(0,0,0,0.75)';
      badge.style.color = '#fff';
      badge.style.padding = '6px 9px';
      badge.style.borderRadius = '999px';
      badge.style.fontSize = '12px';
      badge.style.fontWeight = '700';
      badge.style.minWidth = '28px';
      badge.style.textAlign = 'center';
      badge.style.boxShadow = '0 6px 18px rgba(0,0,0,0.45)';

      // Append into the image element if present, otherwise into card
      // Appending into the image's parent (or the image itself) keeps badge visually inside image
      if (img && img.parentElement) {
        // make sure parent is positioned to allow absolute inside it
        if (getComputedStyle(img.parentElement).position === 'static') {
          img.parentElement.style.position = 'relative';
        }
        img.parentElement.appendChild(badge);
      } else {
        card.appendChild(badge);
      }
    } else {
      // If badge exists but is not child of image wrapper, move it (keeps DOM tidy)
      if (img && img.parentElement && badge.parentElement !== img.parentElement) {
        if (getComputedStyle(img.parentElement).position === 'static') {
          img.parentElement.style.position = 'relative';
        }
        img.parentElement.appendChild(badge);
      }
    }

    if (qty > 0) {
      badge.textContent = qty;
      badge.style.display = 'block';
      card.classList.add('has-items');
    } else {
      badge.style.display = 'none';
      card.classList.remove('has-items');
    }
  });
}

// Wrap existing global addSnack/removeSnack to ensure UI sync and logs.
// (Only wrap if functions exist — safe)
if (typeof addSnack === 'function' && typeof removeSnack === 'function') {
  const __origAddSnack = addSnack;
  const __origRemoveSnack = removeSnack;
  window.addSnack = function(name, price) {
    __origAddSnack(name, price);
    updateSnackCardQtyUI();
    // small debug:
    // console.log('addSnack()', name, price, 'cart:', [...snacksCart.entries()]);
  };
  window.removeSnack = function(name) {
    __origRemoveSnack(name);
    updateSnackCardQtyUI();
    // console.log('removeSnack()', name, 'cart:', [...snacksCart.entries()]);
  };
}

// Also attach listeners to the buttons (handles pages that don't use inline onclick)
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.snack-controls').forEach(ctrl => {
    const plusBtn = ctrl.querySelector('button:first-child');
    const minusBtn = ctrl.querySelector('button:last-child');

    if (plusBtn) {
      plusBtn.addEventListener('click', (e) => {
        const card = plusBtn.closest('.snack-card');
        if (!card) return;
        const title = card.querySelector('h4')?.textContent?.trim();
        // parse price from .price text if available (strip $)
        const priceText = card.querySelector('.price')?.textContent?.replace(/[^0-9.]/g,'') || '';
        const price = priceText ? Number(priceText) : undefined;
        if (title) addSnack(title, price);
      });
    }

    if (minusBtn) {
      minusBtn.addEventListener('click', (e) => {
        const card = minusBtn.closest('.snack-card');
        if (!card) return;
        const title = card.querySelector('h4')?.textContent?.trim();
        if (title) removeSnack(title);
      });
    }
  });

  // initial sync in case cart already has items (e.g. back navigation)
  updateSnackCardQtyUI();
});





// ---------- REPLACE toggleSeat() with this ----------
function toggleSeat(seatElement, seatType) {
    // Do nothing if occupied/booked (extra guard)
    if (seatElement.classList.contains('occupied') || seatElement.classList.contains('booked')) {
        return;
    }

    const seatId = seatElement.dataset.seatId;

    if (seatElement.classList.contains('selected')) {
        seatElement.classList.remove('selected');
        selectedSeats = selectedSeats.filter(seat => seat.id !== seatId);
    } else {
       if (selectedSeats.length >= 8) {
  openToast('<h2>You can select maximum 8 seats at a time.</h2>');
  return;
}

        seatElement.classList.add('selected');
        selectedSeats.push({
            id: seatId,
            row: seatElement.dataset.row,
            number: seatElement.dataset.number,
            type: seatType,
            price: seatPrices[seatType]
        });
    }

    updateSelectedSeatsInfo();
    updatePaymentButton();
}




function updateSelectedSeatsInfo() {
  const seatsText = document.getElementById('selectedSeatsText');
  const totalAmount = document.getElementById('totalAmount');

  if (!selectedSeats || selectedSeats.length === 0) {
    if (seatsText) seatsText.textContent = 'None';
    if (totalAmount) totalAmount.textContent = formatCurrency(0);
    seatTotal = 0;
    return;
  }

  const seatList = selectedSeats.map(seat => `${seat.row}${seat.number}`).join(', ');
  seatTotal = selectedSeats.reduce((sum, seat) => sum + (seat.price || 0), 0);

  if (seatsText) seatsText.textContent = seatList;
  if (totalAmount) totalAmount.textContent = formatCurrency(seatTotal);

  updatePaymentButton();
}





// Update payment button state
function updatePaymentButton() {
    const nextBtn = document.getElementById('nextToSnacks') || document.getElementById('nextToPayment');
    if (nextBtn) nextBtn.disabled = selectedSeats.length === 0;
}

// ---- Reset seats selection + UI ----
function resetSeatSelection() {
  // model clear
  selectedSeats = [];
  seatTotal = 0;

  // UI se selected class hatao
  document.querySelectorAll('.seat.selected').forEach(s => s.classList.remove('selected'));

  // Info texts reset
  const seatsText = document.getElementById('selectedSeatsText');
  const totalAmount = document.getElementById('totalAmount');
  if (seatsText) seatsText.textContent = 'None';
  if (totalAmount) totalAmount.textContent = formatCurrency(0);

  // Proceed button disable
  updatePaymentButton();
}

// Update payment button state
function updatePaymentButton() {
    const nextBtn = document.getElementById('nextToSnacks') || document.getElementById('nextToPayment');
    if (nextBtn) nextBtn.disabled = selectedSeats.length === 0;
}

/* === INSERT: Reset seats helper (exactly here, updatePaymentButton ke turant baad) === */
function resetSeatSelection() {
  // model clear
  selectedSeats = [];
  seatTotal = 0;

  // UI se selected class hatao
  document.querySelectorAll('.seat.selected').forEach(s => s.classList.remove('selected'));

  // Info texts reset
  const seatsText = document.getElementById('selectedSeatsText');
  const totalAmount = document.getElementById('totalAmount');
  if (seatsText) seatsText.textContent = 'None';
  if (totalAmount) totalAmount.textContent = formatCurrency(0);

  // Proceed button disable
  updatePaymentButton();
}




// compute totals from current state (seats + snacks + coupon + tax)
function computeTotals() {
  const seatsTotal = (selectedSeats || []).reduce((sum, s) => sum + (Number(s.price) || 0), 0);
  const snacksTotalCalc = [...snacksCart.values()].reduce((sum, it) => sum + (Number(it.price) * it.qty), 0);
  const discountAmount = (appliedCoupon && Number(appliedCoupon.amount)) ? Number(appliedCoupon.amount) : 0;
  const subtotal = Math.max(0, seatsTotal + snacksTotalCalc - discountAmount);
  const taxRate = typeof window.taxRate !== 'undefined' ? Number(window.taxRate) : 0.10;
  const taxAmount = subtotal * taxRate;
  const grand = subtotal + taxAmount;

  return {
    seatsTotal,
    snacksTotal: snacksTotalCalc,
    discountAmount,
    subtotal,
    taxAmount,
    grand,
    formatted: {
      seatsTotal: formatCurrency ? formatCurrency(seatsTotal) : seatsTotal.toFixed(2),
      snacksTotal: formatCurrency ? formatCurrency(snacksTotalCalc) : snacksTotalCalc.toFixed(2),
      discountAmount: formatCurrency ? formatCurrency(discountAmount) : discountAmount.toFixed(2),
      taxAmount: formatCurrency ? formatCurrency(taxAmount) : taxAmount.toFixed(2),
      grand: formatCurrency ? formatCurrency(grand) : grand.toFixed(2)
    }
  };
}


// Replace existing updateBookingSummary() with this:
// Replace the whole function with this fixed version
function updateBookingSummary() {
  const theaterNames = {
    'downtown': 'CineBook IMAX Downtown',
    'mall': 'CineBook 4DX Mall',
    'luxury': 'CineBook Luxury Central'
  };

  // movie, theater, time, seats
  document.getElementById('summaryMovie').textContent = movieData?.title || 'Selected Movie';
  document.getElementById('summaryTheater').textContent = theaterNames[selectedTheater] || 'Selected Theater';
  document.getElementById('summaryTime').textContent = selectedShowtime || 'N/A';
  document.getElementById('summarySeats').textContent = selectedSeats.length ? selectedSeats.map(s => `${s.row}${s.number}`).join(', ') : 'None';

  // seats total (recalc)
  const seatsTotal = selectedSeats.reduce((sum, s) => sum + (s.price || 0), 0);
  document.getElementById('seatsTotal').textContent = formatCurrency(seatsTotal);

  // snacks total
  const snacksTotalCalc = [...snacksCart.values()].reduce((sum, it) => sum + (it.price * it.qty), 0);
  document.getElementById('snacksTotalInSummary').textContent = formatCurrency(snacksTotalCalc);

  // render inline snack summary (keeps original UL hidden)
  const bookingSummary = document.querySelector('.booking-summary');
  const inlineParts = [];
  for (const [name, item] of snacksCart.entries()) inlineParts.push(`${name} x${item.qty}`);
  const inlineText = inlineParts.length ? inlineParts.join(', ') : 'None';
  const summarySection = bookingSummary ? bookingSummary.querySelector('.summary-section') : null;
  if (summarySection) {
    summarySection.innerHTML = `
      <div class="summary-row">
        <span class="label">Snacks:</span>
        <span class="value" id="summarySnacksInline" style="white-space:normal;">${inlineText}</span>
      </div>
    `;
  }
  // hide old UL if present
  if (document.getElementById('summarySnacksList')) document.getElementById('summarySnacksList').style.display = 'none';

  // compute discount (taken from appliedCoupon.amount if set)
  const discountAmount = (appliedCoupon && appliedCoupon.amount) ? Number(appliedCoupon.amount) : 0;

  // display discount row (insert or update)
  let discountRow = document.getElementById('discountSummaryRow');
  if (!discountRow) {
    discountRow = document.createElement('div');
    discountRow.id = 'discountSummaryRow';
    discountRow.className = 'summary-row small';
    discountRow.innerHTML = `<span class="label">Discount:</span><span id="discountAmount" class="value">${formatCurrency(discountAmount)}</span>`;
    // try to insert before taxes row
    const taxRow = document.getElementById('taxAmount')?.closest('.summary-row') || document.querySelector('.summary-divider');
    if (taxRow && taxRow.parentElement) taxRow.parentElement.insertBefore(discountRow, taxRow);
    else bookingSummary && bookingSummary.appendChild(discountRow);
  } else {
    const discEl = document.getElementById('discountAmount');
    if (discEl) discEl.textContent = formatCurrency(discountAmount);
  }

  // taxable subtotal = seats + snacks - discount
  const subtotalAfterDiscount = Math.max(0, seatsTotal + snacksTotalCalc - discountAmount);

  // taxes (example 10% tax)
  const taxRate = typeof window.taxRate !== 'undefined' ? Number(window.taxRate) : 0.10;
  const taxAmount = subtotalAfterDiscount * taxRate;
  const taxEl = document.getElementById('taxAmount');
  if (taxEl) taxEl.textContent = formatCurrency(taxAmount);

  // grand total
  const grand = subtotalAfterDiscount + taxAmount;
  const summaryTotalEl = document.getElementById('summaryTotal');
  if (summaryTotalEl) summaryTotalEl.textContent = formatCurrency(grand);

  // also update small seats/snacks totals shown earlier (if any)
  // (already updated seatsTotal and snacksTotalInSummary above)
}


  // optional: ensure the old UL is hidden (keeps markup safe)
  const oldUl = document.getElementById('summarySnacksList');
  if (oldUl) oldUl.style.display = 'none';




// Setup form validation
function setupFormValidation() {
    const cardNumber = document.getElementById('cardNumber');
    const expiryDate = document.getElementById('expiryDate');
    const cvv = document.getElementById('cvv');

    // Card number formatting
    cardNumber.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
        let formattedValue = value.match(/.{1,4}/g)?.join(' ') ?? value;
        if (formattedValue.length > 19) formattedValue = formattedValue.substr(0, 19);
        e.target.value = formattedValue;
    });

    // Expiry date formatting
    expiryDate.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length >= 2) {
            value = value.substring(0, 2) + '/' + value.substring(2, 4);
        }
        e.target.value = value;
    });

    // CVV validation
    cvv.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '').substring(0, 3);
    });

      // show/hide the big "Snacks:" title (HTML has .section-title inside .booking-summary)
  const sectionTitle = document.querySelector('.booking-summary .section-title');
  if (sectionTitle) sectionTitle.style.display = (snacksCart.size > 0) ? 'block' : 'none';

}


// Confirm booking
function confirmBooking() {
    const form = document.getElementById('paymentForm');

    // Validate based on payment method
    if (selectedPaymentMethod === 'card') {
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }
    } else {
        // For digital wallets, only validate email and phone
        const email = document.getElementById('email').value;
        const phone = document.getElementById('phone').value;

        if (!email || !phone) {
            alert('Please provide your email and phone number.');
            return;
        }
    }

    // Show loading state
    const confirmBtn = document.getElementById('confirmBooking');
    
    const originalText = confirmBtn.textContent;

    // Update button text based on payment method
    let processingText = 'Processing...';
    if (selectedPaymentMethod === 'paypal') {
        processingText = 'Redirecting to PayPal...';
    } else if (selectedPaymentMethod === 'applepay') {
        processingText = 'Authenticating with Apple Pay...';
    } else if (selectedPaymentMethod === 'googlepay') {
        processingText = 'Processing with Google Pay...';
    }

    confirmBtn.textContent = processingText;
    confirmBtn.disabled = true;

    // Simulate different processing times for different payment methods
    let processingTime = 2000;
    if (selectedPaymentMethod !== 'card') {
        processingTime = 3000; // Longer for digital wallets to simulate redirect/auth
    }

    setTimeout(() => {
        // Generate booking ID
        const bookingId = 'CB' + Date.now().toString().slice(-8);

   // inside setTimeout, replace bookingData construction with this:
const totals = computeTotals();

const bookingData = {
  id: bookingId,
  movie: movieData?.title || 'Selected Movie',
  date: selectedDate || document.querySelector('.date-picker')?.value || 'N/A',
  time: selectedShowtime || 'N/A',
  theater: (selectedTheater === 'downtown' ? 'CineBook IMAX Downtown' :
            selectedTheater === 'mall' ? 'CineBook 4DX Mall' :
            selectedTheater === 'luxury' ? 'CineBook Luxury Central' : 'Selected Theater'),
  seats: selectedSeats.length ? selectedSeats.map(s => `${s.row}${s.number}`) : ['None'],
  snacks: [...snacksCart.values()].map(i => `${i.name} x${i.qty}`).join(', ') || 'None',
  // use formatted grand total
 total: totals.grand,                    // number (e.g. 56.07)
totalFormatted: totals.formatted.grand, // "$56.07"
  status: 'CONFIRMED'
};


        // Show the new ticket-style confirmation modal
        showConfirmation(bookingData);


        // --- SYNC booking to global My Bookings storage + notify UI ---
try {
  // normalize booking shape for compatibility with index loader
   // normalize booking shape for compatibility with index loader
  const normalizedBooking = {
    id: bookingData.id || bookingData.bookingId || ('CB' + Date.now().toString().slice(-8)),
    title: bookingData.movie || bookingData.title || movieData?.title || 'Untitled Movie',
    // keep a minimal movie object so index can show poster if available
    movie: (typeof movieData === 'object' && movieData !== null) ? { title: movieData.title, poster: (movieData.posterThumb || movieData.poster) } : (bookingData.movie && typeof bookingData.movie === 'object' ? bookingData.movie : null),
    poster: (movieData && (movieData.posterThumb || movieData.poster)) || bookingData.poster || 'images/avatar.jpg',
    date: bookingData.date || bookingData.bookingDate || new Date().toISOString().split('T')[0],
    time: bookingData.time || 'N/A',
    theater: bookingData.theater || 'Selected Theater',
    seats: Array.isArray(bookingData.seats) ? bookingData.seats : (bookingData.seats ? [bookingData.seats] : []),
    // normalize snacks into an array of strings
    snacks: Array.isArray(bookingData.snacks) ? bookingData.snacks : (typeof bookingData.snacks === 'string' ? bookingData.snacks.split(',').map(s=>s.trim()).filter(Boolean) : []),
    // store numeric total (without currency symbol) so index can render $ + total safely
   // numeric total
total: (typeof bookingData.total === 'number'
        ? bookingData.total
        : (function(){
            const t = bookingData.total || bookingData.price || bookingData.amount || '0';
            const parsed = parseFloat(String(t).replace(/[^0-9.-]+/g,''));
            return isNaN(parsed) ? 0 : parsed;
          })()),
// pretty string with USD (use given totalFormatted if present)
totalFormatted: bookingData.totalFormatted
                || formatCurrency(
                     typeof bookingData.total === 'number' ? bookingData.total : (
                       parseFloat(String(bookingData.total || '0').replace(/[^0-9.-]+/g,'')) || 0
                     )
                   ),
currency: 'USD',

    bookingDate: new Date().toISOString(),
    status: bookingData.status || 'CONFIRMED'
  };


  // Read existing list from commonly-used keys (backwards compatible)
  let existingRaw = localStorage.getItem('movieBookings') || localStorage.getItem('bookings') || '[]';
  let existing = [];
  try { existing = JSON.parse(existingRaw) || []; } catch (err) { existing = []; }

  // Prevent duplicates by id
  if (!existing.find(b => String(b.id) === String(normalizedBooking.id))) {
    existing.push(normalizedBooking);
  }

  // Save under both keys for compatibility with various scripts
  localStorage.setItem('movieBookings', JSON.stringify(existing));
  localStorage.setItem('bookings', JSON.stringify(existing));

  // Notify any open listeners in same tab (SPA behaviour)
  window.dispatchEvent(new CustomEvent('bookingsUpdated', { detail: { booking: normalizedBooking } }));

  // Optional: If you want to automatically go to index's My Bookings after confirmation:
  // window.location.href = 'index.html#my-bookings'; // uncomment if you want auto-redirect

} catch (err) {
  console.error('Error syncing booking to My Bookings:', err);
}


        // Reset button
        confirmBtn.textContent = originalText;
        confirmBtn.disabled = false;

        // Clear localStorage (movie selection)
        localStorage.removeItem('selectedMovie');

    }, processingTime);
}


// Utility function to format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

// Add smooth transitions for step changes
function addStepTransitions() {
    const steps = document.querySelectorAll('.booking-step');
    steps.forEach(step => {
        step.style.transition = 'opacity 0.3s ease-in-out, transform 0.3s ease-in-out';
    });
}


/* ---------- Confirmation modal handlers & download ---------- */
/* Paste this at the end of booking.js (after all other functions) */

const successModal = document.getElementById('successModal');
const downloadBtn = document.getElementById('downloadTicketBtn');
const bookAnotherBtn = document.getElementById('bookAnotherBtn');

function showConfirmation(bookingData) {
  // populate ticket fields
  document.getElementById('bookId').innerText = bookingData.id || ('#' + Date.now());
  document.getElementById('movieName').innerText = bookingData.movie || 'Unknown Movie';
  document.getElementById('movieDate').innerText = bookingData.date || '';
  document.getElementById('movieTime').innerText = bookingData.time || '';
  document.getElementById('theaterName').innerText = bookingData.theater || '';
  document.getElementById('seatNumbers').innerText = Array.isArray(bookingData.seats) ? bookingData.seats.join(', ') : (bookingData.seats || '');
  document.getElementById('snacksList').innerText = bookingData.snacks || '—';
  document.getElementById('totalAmountTicket').innerText =
  bookingData.totalFormatted
    || (typeof bookingData.total === 'number' ? formatCurrency(bookingData.total) : (bookingData.total || '0'));

  document.getElementById('ticketStatus').innerText = bookingData.status || 'CONFIRMED';

  const successModal = document.getElementById('successModal');
  if (!successModal) return;
  successModal.classList.remove('hidden');
  successModal.setAttribute('aria-hidden', 'false');

  // lock background scroll
  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';

  // focus download button for accessibility
  setTimeout(() => {
    const btn = document.getElementById('downloadTicketBtn') || successModal.querySelector('button');
    if (btn) btn.focus();
  }, 60);
}

function closeConfirmation() {
  const successModal = document.getElementById('successModal');
  if (!successModal) return;
  successModal.classList.add('hidden');
  successModal.setAttribute('aria-hidden', 'true');

  // restore scrolling
  document.documentElement.style.overflow = '';
  document.body.style.overflow = '';
}



// Close when click outside modal content
if (successModal) {
  successModal.addEventListener('click', (e) => {
    if (e.target === successModal) closeConfirmation();
  });
}

// Close on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && successModal && !successModal.classList.contains('hidden')) {
    closeConfirmation();
  }
});

// Book another behaviour (redirect to movies/home)
if (bookAnotherBtn) {
  bookAnotherBtn.addEventListener('click', () => {
    closeConfirmation();
    window.location.href = 'index.html';
  });
}

// Download ticket as PNG + PDF (requires html2canvas + jsPDF CDNs in HTML)
// download only PDF (clone ticket -> html2canvas -> jsPDF)
// Replace your existing downloadBtn handler with this improved version
if (downloadBtn) {
  downloadBtn.addEventListener('click', async () => {
    const ticket = document.getElementById('ticketCard') || document.querySelector('.ticket-card');
    if (!ticket) return alert('Ticket not found for download.');

    try {
      // wait for fonts and a short settle
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      await new Promise(r => setTimeout(r, 60));

      // measure on-screen ticket
      const rect = ticket.getBoundingClientRect();
      const ticketWidthPx = Math.ceil(rect.width);
      const ticketHeightPx = Math.ceil(rect.height);

      // bleed around ticket so pseudo-elements/shadows not clipped
      const bleed = 48; // px (increase to 60/80 if still clipped)
      const wrapperW = ticketWidthPx + bleed * 2;
      const wrapperH = ticketHeightPx + bleed * 2;

      // clone and normalize
      const clone = ticket.cloneNode(true);
      clone.style.boxShadow = 'none';
      clone.style.transform = 'none';
      clone.style.margin = '0';
      clone.style.width = ticketWidthPx + 'px';
      clone.style.height = ticketHeightPx + 'px';
      clone.style.overflow = 'visible';
      clone.style.display = 'block';
      clone.style.boxSizing = 'content-box';
      clone.style.background = getComputedStyle(ticket).backgroundColor || '#ffffff';

      // remove/hide elements we don't want in PDF
      const removeSelectors = [
        '#downloadTicketBtn',
        '#bookAnotherBtn',
        '.btn-row',
        '.no-pdf'
      ];
      removeSelectors.forEach(sel => {
        clone.querySelectorAll(sel).forEach(el => el.remove());
      });

      // Strip transforms/filters on children (prevents weird capture artefacts)
      clone.querySelectorAll('*').forEach(el => {
        el.style.transform = '';
        el.style.filter = '';
        el.style.backdropFilter = '';
      });

      // -------------------------
      // Inject notch elements into the clone's LEFT area so html2canvas WILL capture them.
      // Adjust these values to match your on-screen look.
      // -------------------------
      (function injectNotches(targetClone) {
        // container positioned relative to the clone
        const notchContainer = document.createElement('div');
        notchContainer.className = 'pdf-notch-container';
        notchContainer.style.position = 'absolute';
        // place it so it intersects the red line area (tweak left value if necessary)
        notchContainer.style.left = '-12px'; // pulls into left so notches cut into the line
        notchContainer.style.top = '0';
        notchContainer.style.width = '24px';
        notchContainer.style.height = '100%';
        notchContainer.style.pointerEvents = 'none';
        notchContainer.style.boxSizing = 'border-box';
        // ensure it sits on top visually
        notchContainer.style.zIndex = '9999';

        // config for notches
        const notchSize = 12;    // square notch size in px
        const notchGap = 22;     // vertical distance between notch centers
        const topOffset = 18;    // start offset from top (to avoid rounded corner)
        const bottomOffset = 18; // bottom offset

        const availableHeight = ticketHeightPx - topOffset - bottomOffset;
        const count = Math.floor(availableHeight / notchGap);

        for (let i = 0; i < count; i++) {
          const y = topOffset + i * notchGap;

          const n = document.createElement('div');
          n.className = 'pdf-notch';
          n.style.position = 'absolute';
          n.style.left = '6px'; // center within 24px wide notch container (adjust)
          n.style.top = y + 'px';
          n.style.width = notchSize + 'px';
          n.style.height = notchSize + 'px';
          n.style.borderRadius = '2px';
          // color must match outer page background (if you want white cutouts use '#fff')
          // In your case page background is white when saving, so use white.
          n.style.background = '#ffffff';
          n.style.boxSizing = 'border-box';
          // If you want small gap between notch and red line, tweak left/top values earlier
          notchContainer.appendChild(n);
        }

        // ensure targetClone is positioned (so absolute children are relative to it)
        if (getComputedStyle(targetClone).position === 'static') targetClone.style.position = 'relative';
        targetClone.appendChild(notchContainer);
      })(clone);

      // Off-screen wrapper with padding = bleed
      const wrapper = document.createElement('div');
      wrapper.style.position = 'fixed';
      wrapper.style.top = '-9999px';
      wrapper.style.left = '-9999px';
      wrapper.style.width = wrapperW + 'px';
      wrapper.style.height = wrapperH + 'px';
      wrapper.style.overflow = 'visible';
      wrapper.style.padding = bleed + 'px';
      wrapper.style.background = '#ffffff';
      wrapper.style.boxSizing = 'content-box';
      wrapper.appendChild(clone);
      document.body.appendChild(wrapper);

      // capture using html2canvas
      const DPR = Math.min(window.devicePixelRatio || 1, 2);
      const canvas = await html2canvas(wrapper, {
        scale: DPR,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        allowTaint: false
      });

      // cleanup DOM
      document.body.removeChild(wrapper);

      // convert canvas -> image
      const imgData = canvas.toDataURL('image/png');
      const canvasW = canvas.width;
      const canvasH = canvas.height;

      // ---------- Create A4 PDF and scale image to fit ----------
      const _w = window;
      const jsPDFConstructor =
        (_w.jspdf && _w.jspdf.jsPDF) ||
        _w.jsPDF ||
        _w.jspdf ||
        null;

      if (!jsPDFConstructor) {
        alert('PDF library not loaded. Include jsPDF.');
        return;
      }

      const pdf = new jsPDFConstructor({ unit: 'pt', format: 'a4' });
      const pageWidthPt = pdf.internal.pageSize.getWidth();
      const pageHeightPt = pdf.internal.pageSize.getHeight();

      // convert px -> points: 1px = 72/96 pt
      const pxToPt = 72 / 96;
      const imgWPt = Math.round(canvasW * pxToPt);
      const imgHPt = Math.round(canvasH * pxToPt);

      // margins on PDF page (pt)
      const marginPt = 20;
      const maxW = pageWidthPt - marginPt * 2;
      const maxH = pageHeightPt - marginPt * 2;

      // scale image to fit inside page while preserving aspect ratio
      let renderW = imgWPt;
      let renderH = imgHPt;
      const ratio = imgWPt / imgHPt;
      if (renderW > maxW) {
        renderW = maxW;
        renderH = Math.round(renderW / ratio);
      }
      if (renderH > maxH) {
        renderH = maxH;
        renderW = Math.round(renderH * ratio);
      }

      const x = Math.round((pageWidthPt - renderW) / 2);
      const y = Math.round((pageHeightPt - renderH) / 2);

      pdf.addImage(imgData, 'PNG', x, y, renderW, renderH);

      // save with booking id filename
      const fileBase = (document.getElementById('bookId')?.innerText || 'ticket').replace(/[^a-z0-9\-_]/ig,'') || 'ticket';
      pdf.save(fileBase + '.pdf');

    } catch (err) {
      console.error('PDF download failed', err);
      alert('Unable to generate PDF. Try again.');
    }
  });
} 



// If this page was opened to VIEW an existing booking (index sets viewBookingId before redirect)
// then find that booking in storage and show its confirmation modal.
document.addEventListener('DOMContentLoaded', () => {
  const viewId = localStorage.getItem('viewBookingId');
  if (!viewId) return;

  try {
    const stored = JSON.parse(localStorage.getItem('movieBookings') || localStorage.getItem('bookings') || '[]');
    const booking = Array.isArray(stored) ? stored.find(b => String(b.id) === String(viewId) || String(b.bookingId) === String(viewId)) : null;
    if (booking) {
      // showConfirmation expects fields like movie, date, time, seats, snacks, total
      // ensure shapes: convert snacks array -> printable string, total -> formatted string
      const displayBooking = {
        id: booking.id || booking.bookingId,
        movie: (booking.movie && (booking.movie.title || booking.movie.name)) || booking.title || 'Unknown Movie',
        date: booking.date || 'N/A',
        time: booking.time || 'N/A',
        theater: booking.theater || (booking.showtime && booking.showtime.theater) || 'N/A',
        seats: booking.seats || booking.seatNumbers || [],
        snacks: Array.isArray(booking.snacks) ? booking.snacks.join(', ') : (booking.snacks || 'None'),
        total: (typeof booking.total === 'number') ? formatCurrency(booking.total) : (booking.totalFormatted || booking.total || '0'),
        status: booking.status || 'CONFIRMED'
      };

      showConfirmation(displayBooking);
    } else {
      console.warn('Booking not found for viewId', viewId);
    }
  } catch (err) {
    console.error('Error opening booking for viewId', err);
  } finally {
    localStorage.removeItem('viewBookingId');
  }
});



// If this page was opened to VIEW an existing booking (index sets viewBookingId before redirect)
document.addEventListener('DOMContentLoaded', () => {
  const viewId = localStorage.getItem('viewBookingId');
  if (!viewId) return;

  try {
    const stored = JSON.parse(localStorage.getItem('movieBookings') || localStorage.getItem('bookings') || '[]');
    const booking = Array.isArray(stored) ? stored.find(b => String(b.id) === String(viewId) || String(b.bookingId) === String(viewId)) : null;
    if (booking) {
      const displayBooking = {
        id: booking.id || booking.bookingId,
        movie: (booking.movie && (booking.movie.title || booking.movie.name)) || booking.title || 'Unknown Movie',
        date: booking.date || 'N/A',
        time: booking.time || 'N/A',
        theater: booking.theater || (booking.showtime && booking.showtime.theater) || 'N/A',
        seats: booking.seats || booking.seatNumbers || [],
        snacks: Array.isArray(booking.snacks) ? booking.snacks.join(', ') : (booking.snacks || 'None'),
       totalFormatted: booking.totalFormatted || formatCurrency(booking.total || 0),
        status: booking.status || 'CONFIRMED'
      };

      showConfirmation(displayBooking);
    } else {
      console.warn('Booking not found for viewId', viewId);
    }
  } catch (err) {
    console.error('Error opening booking for viewId', err);
  } finally {
    // remove identifier so reloading booking.html won't try to open it again
    localStorage.removeItem('viewBookingId');
  }
});
