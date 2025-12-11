/* app.js - Combined sliders (main carousel + testimonials) - robust, DOM-ready, with fallbacks
   Replaces and hardens the existing app.js to avoid runtime misses and to support multiple id variants.
*/

(function () {
    // run after DOM ready
    function onReady(fn) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
        else fn();
    }

    onReady(() => {

        /* --------------------------
           Marquee pause helper (keeps as-is)
           -------------------------- */
        (function marqueePause() {
            const marquee = document.querySelector('.logos-marquee');
            if (!marquee) return;
            function setPaused(on) { marquee.classList.toggle('paused', !!on); }
            marquee.addEventListener('mouseenter', () => setPaused(true));
            marquee.addEventListener('mouseleave', () => setPaused(false));
            marquee.addEventListener('focusin', () => setPaused(true));
            marquee.addEventListener('focusout', () => setPaused(false));
            let touchTimer = null;
            marquee.addEventListener('touchstart', () => {
                setPaused(true);
                if (touchTimer) clearTimeout(touchTimer);
                touchTimer = setTimeout(() => setPaused(false), 1200);
            }, { passive: true });
            if (!marquee.hasAttribute('tabindex')) marquee.setAttribute('tabindex', '0');
        })();


        /* --------------------------
           Testimonials manual carousel (robust)
           Supports id variants:
             - track: testimonialTrack OR testimonialTrack-1
             - prev / next buttons: testimonialPrev / testimonialPrev-1 etc.
           -------------------------- */
        (function initTestimonialsManual() {
            // Try multiple id variants (user had testimonialTrack and testimonialTrack-1 in different snippets)
            const trackIdCandidates = ['testimonialTrack', 'testimonialTrack-1', 'testimonialTrack1'];
            let track = null;
            for (const id of trackIdCandidates) {
                track = document.getElementById(id);
                if (track) break;
            }
            if (!track) {
                // If there is a container with class testimonial-track we can use its parent as viewport and the element itself as track
                track = document.querySelector('.testimonial-track') || null;
            }
            if (!track) return console.info('[testimonials] no testimonial track found, skipping init.');

            // Determine viewport: user markup used .testimonial-viewport parent or immediate parent
            let viewport = track.parentElement;
            if (viewport && !viewport.classList.contains('testimonial-viewport')) {
                // try to find ancestor with expected class
                const vp = track.closest('.testimonial-viewport');
                if (vp) viewport = vp;
            }

            // Find prev/next buttons (supporting multiple naming variants)
            function findBtn(nameBase) {
                const ids = [nameBase, nameBase + '-1', nameBase + '1', nameBase.replace('testimonial', 'testimonials')];
                for (const id of ids) {
                    const el = document.getElementById(id);
                    if (el) return el;
                }
                // fallback: find button with class
                return document.querySelector(`.${nameBase}`) || null;
            }

            const prevBtn = findBtn('testimonialPrev') || findBtn('testimonial-prev');
            const nextBtn = findBtn('testimonialNext') || findBtn('testimonial-next');

            // if buttons aren't present, don't fail — we'll still allow swipe
            if (!viewport) return console.warn('[testimonials] viewport not found for track.'); // can't continue without viewport

            let cards = Array.from(track.querySelectorAll('.testimonial-card'));
            if (cards.length === 0) return console.info('[testimonials] no testimonial cards found.');

            let index = 0;
            let visibleCount = 1;
            let step = 0;
            const DEFAULT_GAP = 24;

            function readGap(container) {
                try {
                    const cs = window.getComputedStyle(container);
                    const gapVal = cs.getPropertyValue('gap') || cs.getPropertyValue('column-gap') || cs.getPropertyValue('grid-column-gap');
                    if (gapVal) {
                        const parsed = parseFloat(gapVal);
                        if (!Number.isNaN(parsed)) return parsed;
                    }
                } catch (e) { /* ignore */ }
                // fallback: if first two children exist, compute based on offsets
                const children = Array.from(container.children);
                if (children.length >= 2) {
                    const a = children[0].getBoundingClientRect();
                    const b = children[1].getBoundingClientRect();
                    return Math.max(DEFAULT_GAP, b.left - (a.left + a.width));
                }
                return DEFAULT_GAP;
            }

            function calcMetrics() {
                cards = Array.from(track.querySelectorAll('.testimonial-card'));
                if (cards.length === 0) return;
                const firstCard = cards[0];
                const cardRect = firstCard.getBoundingClientRect();
                const cardW = Math.round(cardRect.width);
                const viewportW = Math.round(viewport.getBoundingClientRect().width);
                const GAP = readGap(track) || DEFAULT_GAP;
                // how many cards fit fully in viewport
                visibleCount = Math.max(1, Math.floor((viewportW + GAP) / (cardW + GAP)));
                step = cardW + GAP;
                // clamp index
                const maxIndex = Math.max(0, cards.length - visibleCount);
                if (index > maxIndex) index = maxIndex;
                updateButtons();
                updatePosition(false);
            }

            function updatePosition(animate = true) {
                const x = index * step;
                if (animate) {
                    track.style.transition = 'transform 480ms cubic-bezier(.2,.9,.3,1)';
                } else {
                    track.style.transition = 'none';
                }
                track.style.transform = `translateX(-${x}px)`;
                // trigger reflow if we disabled transition so that subsequent changes animate
                if (!animate) { void track.offsetWidth; track.style.transition = 'transform 480ms cubic-bezier(.2,.9,.3,1)'; }
                updateButtons();
            }

            function updateButtons() {
                if (!prevBtn && !nextBtn) return;
                const maxIndex = Math.max(0, cards.length - visibleCount);
                if (prevBtn) {
                    if (index <= 0) prevBtn.setAttribute('disabled', ''); else prevBtn.removeAttribute('disabled');
                }
                if (nextBtn) {
                    if (index >= maxIndex) nextBtn.setAttribute('disabled', ''); else nextBtn.removeAttribute('disabled');
                }
            }

            // Attach prev/next if present
            if (prevBtn) {
                prevBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    index = Math.max(0, index - 1);
                    updatePosition();
                });
            }
            if (nextBtn) {
                nextBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const maxIndex = Math.max(0, cards.length - visibleCount);
                    index = Math.min(maxIndex, index + 1);
                    updatePosition();
                });
            }

            // Touch support (swipe)
            (function enableTouch() {
                let startX = 0, dx = 0, dragging = false;
                viewport.addEventListener('touchstart', (e) => {
                    dragging = true;
                    dx = 0;
                    startX = e.touches && e.touches[0] ? e.touches[0].clientX : 0;
                    track.style.transition = 'none';
                }, { passive: true });

                viewport.addEventListener('touchmove', (e) => {
                    if (!dragging) return;
                    const curX = e.touches && e.touches[0] ? e.touches[0].clientX : 0;
                    dx = curX - startX;
                    // limit visual overdrag for polish
                    const overdrag = Math.max(-viewport.clientWidth * 0.25, Math.min(viewport.clientWidth * 0.25, dx));
                    track.style.transform = `translateX(-${Math.max(0, index * step - overdrag)}px)`;
                }, { passive: true });

                const endDrag = () => {
                    if (!dragging) return;
                    dragging = false;
                    const threshold = Math.min(viewport.clientWidth * 0.12, 60);
                    if (dx < -threshold) { index = Math.min(cards.length - visibleCount, index + 1); }
                    else if (dx > threshold) { index = Math.max(0, index - 1); }
                    dx = 0;
                    updatePosition();
                };

                viewport.addEventListener('touchend', endDrag, { passive: true });
                viewport.addEventListener('touchcancel', () => { dragging = false; updatePosition(); }, { passive: true });
            })();

            // keyboard navigation inside viewport (optional)
            viewport.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowLeft') {
                    index = Math.max(0, index - 1); updatePosition();
                } else if (e.key === 'ArrowRight') {
                    index = Math.min(Math.max(0, cards.length - visibleCount), index + 1); updatePosition();
                }
            });

            // Recalc on resize (debounced)
            let resizeTimer = null;
            function handleResize() {
                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(() => calcMetrics(), 160);
            }
            window.addEventListener('resize', handleResize);

            // initial calc
            calcMetrics();

        })();


        /* --------------------------
           Robust Mobile Menu (keeps your implementation but ensures safe defaults)
           -------------------------- */
        (function mobileMenu() {
            // This block is essentially the same as before but executed after DOM is ready.
            // It preserves the functionality you already wrote: fallback IDs, backdrop creation, trap focus, open/close, resize behavior.
            // We'll reuse the code from your original and keep it mostly identical (no functional change).
            // NOTE: duplicate mobile menu logic is intentionally preserved for compatibility.

            // First implementation (using mobileMenuBtn / prxMobileBtn)
            (function () {
                const mobileBtn = document.getElementById('mobileMenuBtn')
                    || document.getElementById('prxMobileBtn')
                    || document.querySelector('.prx-mobile-btn');

                const mobileMenu = document.getElementById('mobileMenu')
                    || document.getElementById('prxMobileMenu')
                    || document.querySelector('#prxMobileMenu');

                if (!mobileBtn || !mobileMenu) {
                    // keep silent if missing (host page may not include this block)
                    // console.warn('Mobile menu elements not found (checked mobileMenuBtn/prxMobileBtn and mobileMenu/prxMobileMenu).');
                    return;
                }

                let backdrop = document.getElementById('mobileMenuBackdrop') || document.getElementById('prxBackdrop') || null;
                if (!backdrop) {
                    backdrop = document.createElement('div');
                    backdrop.id = 'mobileMenuBackdrop';
                    Object.assign(backdrop.style, {
                        position: 'fixed',
                        inset: '0',
                        background: 'rgba(0,0,0,0.36)',
                        zIndex: '99998',
                        display: 'none',
                        opacity: '0',
                        transition: 'opacity 220ms ease'
                    });
                    document.body.appendChild(backdrop);
                }

                if (mobileMenu.parentElement !== document.body) document.body.appendChild(mobileMenu);

                Object.assign(mobileMenu.style, {
                    position: mobileMenu.style.position || 'fixed',
                    left: '0',
                    right: '0',
                    top: mobileMenu.style.top || '64px',
                    zIndex: mobileMenu.style.zIndex || '99999',
                    display: 'none',
                    maxHeight: 'calc(100vh - 64px)',
                    overflowY: 'auto',
                    WebkitOverflowScrolling: 'touch',
                    background: mobileMenu.style.background || '#fff',
                    transition: 'transform 280ms cubic-bezier(.2,.9,.25,1), opacity 220ms ease',
                    transform: 'translateY(-8px)',
                    opacity: '0'
                });

                function trapFocus(container) {
                    const focusable = container.querySelectorAll('a,button,input,select,textarea,[tabindex]:not([tabindex="-1"])');
                    if (!focusable || focusable.length === 0) return () => { };
                    let first = focusable[0], last = focusable[focusable.length - 1];
                    function onKey(e) {
                        if (e.key !== 'Tab') return;
                        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
                    }
                    document.addEventListener('keydown', onKey);
                    return () => document.removeEventListener('keydown', onKey);
                }

                let removeTrap = null;

                function openMenu() {
                    // 1) Ensure menu is appended to body (keeps positioning consistent)
                    if (mobileMenu.parentElement !== document.body) document.body.appendChild(mobileMenu);

                    // 2) Position menu directly under the header (handles different header heights / iPhone notch)
                    const header = document.querySelector('header') || document.querySelector('.prx-header') || document.querySelector('.prx-nav');
                    const headerHeight = header ? Math.ceil(header.getBoundingClientRect().height) : 64;
                    // add a small gap so the first item is not hidden by the header
                    const gap = 8;
                    mobileMenu.style.top = (headerHeight + gap) + 'px';
                    mobileMenu.style.position = 'fixed';
                    mobileMenu.style.left = '0';
                    mobileMenu.style.right = '0';
                    mobileMenu.style.zIndex = mobileMenu.style.zIndex || '99999';

                    // 3) Show menu & backdrop immediately (so it's not aria-hidden when we focus)
                    mobileMenu.style.display = 'block';
                    mobileMenu.classList && mobileMenu.classList.add('open'); // if you use class-based styles
                    mobileMenu.setAttribute('aria-hidden', 'false');

                    backdrop.style.display = 'block';
                    // animate in next frame for smooth transition
                    requestAnimationFrame(() => {
                        mobileMenu.style.transform = 'translateY(0)';
                        mobileMenu.style.opacity = '1';
                        backdrop.style.opacity = '1';
                        backdrop.style.pointerEvents = 'auto';
                    });

                    document.documentElement.style.overflow = 'hidden';
                    mobileBtn.setAttribute('aria-expanded', 'true');

                    // 4) Move focus after aria-hidden removed and menu visible
                    const focusCandidate = mobileMenu.querySelector('a,button,input,select,textarea');
                    if (focusCandidate) {
                        // small timeout gives browser time to render and also avoids the aria-hidden block
                        setTimeout(() => { try { focusCandidate.focus(); } catch (e) { /* ignore */ } }, 120);
                    }

                    // 5) trap focus for accessibility
                    removeTrap = trapFocus(mobileMenu);
                }

                function closeMenu() {
                    mobileMenu.style.transform = 'translateY(-8px)';
                    mobileMenu.style.opacity = '0';
                    backdrop.style.opacity = '0';
                    backdrop.style.pointerEvents = 'none';
                    mobileBtn.setAttribute('aria-expanded', 'false');
                    document.documentElement.style.overflow = '';
                    if (removeTrap) { removeTrap(); removeTrap = null; }
                    setTimeout(() => {
                        if (mobileMenu.style && mobileMenu.style.opacity === '0') mobileMenu.style.display = 'none';
                        backdrop.style.display = 'none';
                    }, 260);
                    try { mobileBtn.focus(); } catch (e) { /* ignore */ }
                }

                mobileBtn.addEventListener('click', (ev) => {
                    ev.preventDefault(); ev.stopPropagation();
                    const isOpen = mobileMenu.style.display === 'block' || mobileMenu.style.opacity === '1';
                    if (isOpen) closeMenu(); else openMenu();
                });

                backdrop.addEventListener('click', closeMenu);
                Array.from(mobileMenu.querySelectorAll('a[href], button')).forEach(el =>
                    el.addEventListener('click', () => setTimeout(closeMenu, 60))
                );
                document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
                window.addEventListener('resize', () => { if (window.innerWidth > 960) closeMenu(); });

            })();

            // Second implementation (prxMobileBtn + prxMobileMenu) kept for safety
            (function () {
                const btn = document.getElementById('prxMobileBtn');
                const menu = document.getElementById('prxMobileMenu');
                const backdropId = 'prxMobileMenuBackdrop';
                let backdrop = document.getElementById(backdropId);
                if (!backdrop) {
                    backdrop = document.createElement('div');
                    backdrop.id = backdropId;
                    backdrop.className = 'prx-backdrop';
                    document.body.appendChild(backdrop);
                }
                if (!btn || !menu) return;
                function openMenu() {
                    if (menu.parentElement !== document.body) document.body.appendChild(menu);

                    const header = document.querySelector('header') || document.querySelector('.prx-header') || document.querySelector('.prx-nav');
                    const headerHeight = header ? Math.ceil(header.getBoundingClientRect().height) : 64;
                    const gap = 8;
                    menu.style.top = (headerHeight + gap) + 'px';
                    menu.style.position = 'fixed';
                    menu.style.left = '0';
                    menu.style.right = '0';
                    menu.style.zIndex = menu.style.zIndex || '99999';

                    menu.style.display = 'block';
                    menu.classList.add('open');
                    menu.setAttribute('aria-hidden', 'false');

                    backdrop.style.display = 'block';
                    requestAnimationFrame(() => {
                        menu.style.transform = 'translateY(0)';
                        menu.style.opacity = '1';
                        backdrop.style.opacity = '1';
                        backdrop.style.pointerEvents = 'auto';
                    });

                    document.documentElement.style.overflow = 'hidden';
                    btn.setAttribute('aria-expanded', 'true');

                    const focusCandidate = menu.querySelector('a,button,input,select,textarea');
                    if (focusCandidate) setTimeout(() => { try { focusCandidate.focus(); } catch (e) { } }, 120);
                }
                function closeMenu() {
                    menu.classList.remove('open');
                    backdrop.classList.remove('open', 'show');
                    btn.setAttribute('aria-expanded', 'false');
                    document.documentElement.style.overflow = '';
                    btn.focus();
                }
                btn.addEventListener('click', (e) => { e.stopPropagation(); if (menu.classList.contains('open')) closeMenu(); else openMenu(); });
                backdrop.addEventListener('click', closeMenu);
                menu.addEventListener('click', (e) => { const t = e.target; if (t.tagName === 'A' || t.tagName === 'BUTTON') setTimeout(closeMenu, 100); });
                document.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape' && menu.classList.contains('open')) closeMenu();
                    else if (menu.classList.contains('open') && (e.key === 'Tab')) {
                        const focusable = Array.from(menu.querySelectorAll('a, button, input, [tabindex]:not([tabindex="-1"])')).filter(el => !el.disabled);
                        if (focusable.length === 0) { e.preventDefault(); return; }
                        const first = focusable[0]; const last = focusable[focusable.length - 1];
                        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
                    }
                });
                window.addEventListener('resize', () => { if (window.innerWidth > 960 && menu.classList.contains('open')) closeMenu(); });
            })();

        })(); // end mobileMenu wrapper

    }); // end onReady

})();

/* === Robust main carousel with canonical-order dot sync ===
   Replace your existing carousel logic with this block.
*/
(function () {
    document.addEventListener('DOMContentLoaded', () => {
        const carousel = document.querySelector('.carousel');
        if (!carousel) return console.info('[carousel] not found');

        const list = carousel.querySelector('.list');
        const thumbsContainer = carousel.querySelector('.thumbnail');
        const dotsContainer = carousel.querySelector('.dots');
        const prevBtn = carousel.querySelector('#prev');
        const nextBtn = carousel.querySelector('#next');
        const timeBar = carousel.querySelector('.time');

        // Defensive: ensure elements exist
        if (!list) return console.warn('[carousel] .list not found');

        // helper: read image src safely (normalized)
        const getImgSrc = (el) => {
            const img = el?.querySelector && el.querySelector('img');
            return img ? img.getAttribute('src') : null;
        };

        // Capture canonical/original order of images (array of src strings)
        const initialNodes = Array.from(list.querySelectorAll('.item'));
        const originalOrder = initialNodes.map(n => getImgSrc(n));

        // Build thumbs/dots if not present
        function ensureThumbsAndDots() {
            if (thumbsContainer && thumbsContainer.children.length === 0) {
                originalOrder.forEach(src => {
                    const node = document.createElement('div');
                    node.className = 'item';
                    const img = document.createElement('img');
                    img.src = src;
                    node.appendChild(img);
                    thumbsContainer.appendChild(node);
                });
            }
            if (dotsContainer && dotsContainer.children.length === 0) {
                originalOrder.forEach((_, i) => {
                    const btn = document.createElement('button');
                    if (i === 0) btn.classList.add('active');
                    dotsContainer.appendChild(btn);
                });
            }
        }
        ensureThumbsAndDots();

        // Utility: find index in originalOrder by src
        function findOriginalIndexBySrc(src) {
            return originalOrder.findIndex(s => s === src);
        }

        // Get current visible node (first element in rotated list)
        function currentFirstNode() {
            return list.firstElementChild;
        }

        // Compute active index (in canonical order) by comparing src
        function computeActiveIndex() {
            const cur = currentFirstNode();
            const curSrc = getImgSrc(cur);
            const idx = findOriginalIndexBySrc(curSrc);
            // fallback to 0
            return idx >= 0 ? idx : 0;
        }

        // Sync visuals for thumbs and dots based on canonical index
        function syncThumbsAndDots() {
            const activeIndex = computeActiveIndex();
            // thumbs
            if (thumbsContainer) {
                Array.from(thumbsContainer.querySelectorAll('.item')).forEach((t, i) => {
                    const tSrc = getImgSrc(t);
                    t.classList.toggle('active', tSrc === getImgSrc(currentFirstNode()));
                });
            }
            // dots
            if (dotsContainer) {
                const dots = Array.from(dotsContainer.querySelectorAll('button'));
                dots.forEach((d, i) => d.classList.toggle('active', i === activeIndex));
            }
        }

        // Minimal rotation helper: rotate left (append first -> end) or rotate right (insert last -> front)
        function rotateLeft(times = 1) {
            for (let k = 0; k < times; k++) {
                const first = list.firstElementChild;
                if (!first) break;
                list.appendChild(first);
            }
        }
        function rotateRight(times = 1) {
            for (let k = 0; k < times; k++) {
                const last = list.lastElementChild;
                if (!last) break;
                list.insertBefore(last, list.firstElementChild);
            }
        }

        // Go to canonical index `targetIdx` (0..n-1)
        function goTo(targetIdx) {
            if (targetIdx < 0 || targetIdx >= originalOrder.length) return;
            // find where the target currently sits in DOM (its src)
            const targetSrc = originalOrder[targetIdx];
            // find its current position in the DOM (index among current list children)
            const currentDomNodes = Array.from(list.querySelectorAll('.item'));
            const domIndex = currentDomNodes.findIndex(n => getImgSrc(n) === targetSrc);
            if (domIndex === -1) return; // shouldn't happen

            // Decide shortest rotation direction
            const total = currentDomNodes.length;
            // if domIndex is 0 it's already first
            if (domIndex === 0) {
                // already visible
                syncThumbsAndDots();
                restartTimeBar();
                return;
            }

            // If rotating left domIndex times will bring target to front
            // Rotating right (total - domIndex) times will also bring it front.
            if (domIndex <= total / 2) {
                rotateLeft(domIndex);
            } else {
                rotateRight(total - domIndex);
            }
            syncThumbsAndDots();
            restartTimeBar();
        }

        // Next / Prev helpers (move 1 step)
        function next() {
            rotateLeft(1);
            syncThumbsAndDots();
            restartTimeBar();
        }
        function prev() {
            rotateRight(1);
            syncThumbsAndDots();
            restartTimeBar();
        }

        // Time bar restart (safe)
        function restartTimeBar() {
            if (!timeBar) return;
            timeBar.style.animation = 'none';
            // force reflow
            void timeBar.offsetWidth;
            timeBar.style.animation = `runningTime 7000ms linear 1 forwards`; // match your CSS duration
        }

        // Wire prev/next
        if (nextBtn) nextBtn.addEventListener('click', (e) => { e.preventDefault(); stopAuto(); next(); });
        if (prevBtn) prevBtn.addEventListener('click', (e) => { e.preventDefault(); stopAuto(); prev(); });

        // Wire thumbnail clicks (map src -> canonical index -> goTo)
        if (thumbsContainer) {
            Array.from(thumbsContainer.querySelectorAll('.item')).forEach((el) => {
                el.addEventListener('click', () => {
                    const s = getImgSrc(el);
                    const idx = findOriginalIndexBySrc(s);
                    if (idx >= 0) { stopAuto(); goTo(idx); }
                });
            });
        }

        // Wire dot clicks
        if (dotsContainer) {
            Array.from(dotsContainer.querySelectorAll('button')).forEach((btn, i) => {
                btn.addEventListener('click', () => {
                    stopAuto();
                    goTo(i);
                });
            });
        }

        // Autoplay
        let autoplay = null;
        function startAuto() {
            stopAuto();
            restartTimeBar();
            autoplay = setInterval(() => { next(); }, 7000); // slightly longer than runningTime
        }
        function stopAuto() {
            if (autoplay) { clearInterval(autoplay); autoplay = null; }
            if (timeBar) { timeBar.style.animation = 'none'; }
        }

        // Pause on hover/focus
        carousel.addEventListener('mouseenter', stopAuto);
        carousel.addEventListener('mouseleave', startAuto);
        carousel.addEventListener('focusin', stopAuto);
        carousel.addEventListener('focusout', startAuto);

        // Init sync and autoplay
        syncThumbsAndDots();
        startAuto();

        // expose for debug
        window.__PRX_carousel = { goTo, next, prev, startAuto, stopAuto, originalOrder };

    }); // DOMContentLoaded
})();
