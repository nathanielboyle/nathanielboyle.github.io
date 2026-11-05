/* nathaniel boyle — page behaviour (no dependencies) */
(function () {
  'use strict';

  var isMobile = function () { return window.innerWidth <= 768; };
  var play = function (video) {
    var p = video.play();
    if (p && p.catch) p.catch(function () {});
  };

  /* Muted background videos play only while on screen */
  function autoplayWhenVisible(selector, threshold) {
    var videos = document.querySelectorAll(selector);
    if (!videos.length || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) play(entry.target); else entry.target.pause();
      });
    }, { threshold: threshold });
    videos.forEach(function (v) { v.muted = true; io.observe(v); });
  }

  /* "Latest" reels: looping drag carousel on desktop, native swipe on mobile */
  function initReels(section) {
    var track = section.querySelector('.reels-shop__track');
    var wrapper = section.querySelector('.reels-shop__wrapper');
    var originals = Array.prototype.slice.call(section.querySelectorAll('.reels-shop__card'));
    if (!track || !wrapper || !originals.length) return;

    var real = originals.length;
    var clones = Math.max(real, 6);
    var i, clone;
    for (i = 0; i < clones; i++) {
      clone = originals[(real - 1 - (i % real) + real) % real].cloneNode(true);
      clone.setAttribute('data-clone', 'before');
      track.insertBefore(clone, track.firstChild);
    }
    for (i = 0; i < clones; i++) {
      clone = originals[i % real].cloneNode(true);
      clone.setAttribute('data-clone', 'after');
      track.appendChild(clone);
    }

    var index = clones, slide = 0, gap = 20, translate = 0;
    var animating = false, dragging = false, dragged = false, startX = 0;

    function measure() {
      if (isMobile() || !track.children.length) return;
      slide = track.children[0].getBoundingClientRect().width;
      gap = parseFloat(getComputedStyle(track).gap) || 20;
    }
    function offsetFor(idx) { return -(idx * (slide + gap)) + slide + gap; }
    function setTranslate(value, immediate) {
      if (isMobile()) return;
      track.style.transition = immediate ? 'none' : 'transform 0.4s cubic-bezier(0.25, 0.1, 0.25, 1)';
      if (immediate) void track.offsetWidth;
      track.style.transform = 'translateX(' + value + 'px)';
      translate = value;
    }
    function go(idx, animate) {
      if (isMobile() || animating) return;
      index = Math.max(0, Math.min(track.children.length - 1, idx));
      var next = offsetFor(index);
      if (animate && Math.abs(next - translate) > 0.5) animating = true;
      setTranslate(next, !animate);
    }
    function normalize() {
      var first = clones, last = clones + real - 1;
      if (index < first) index += real;
      else if (index > last) index -= real;
      else return;
      setTranslate(offsetFor(index), true);
    }
    function reset() {
      if (isMobile()) {
        track.style.transform = '';
        track.style.transition = '';
        return;
      }
      animating = false;
      measure();
      if (slide > 0) setTranslate(offsetFor(index), true);
    }

    track.addEventListener('transitionend', function (e) {
      if (e.propertyName !== 'transform') return;
      animating = false;
      normalize();
    });
    var prev = section.querySelector('.reels-shop__nav--prev');
    var next = section.querySelector('.reels-shop__nav--next');
    if (prev) prev.addEventListener('click', function () { go(index - 1, true); });
    if (next) next.addEventListener('click', function () { go(index + 1, true); });

    wrapper.addEventListener('pointerdown', function (e) {
      if (isMobile() || e.target.closest('.reels-shop__sound')) return;
      if (e.pointerType === 'mouse') e.preventDefault();
      dragging = true; dragged = false; startX = e.clientX;
      track.style.transition = 'none';
      wrapper.classList.add('dragging');
      function move(ev) {
        if (Math.abs(ev.clientX - startX) > 5) dragged = true;
        track.style.transform = 'translateX(' + (translate + ev.clientX - startX) + 'px)';
      }
      function up(ev) {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        dragging = false;
        wrapper.classList.remove('dragging');
        var delta = ev.clientX - startX;
        go(index + (delta < -50 ? 1 : delta > 50 ? -1 : 0), true);
        setTimeout(function () { dragged = false; }, 0);
      }
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    });

    /* Mobile: the card in view plays, the rest rest on their poster */
    var mobileObserver = null;
    function watchMobile() {
      if (!isMobile() || mobileObserver || !('IntersectionObserver' in window)) return;
      mobileObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!isMobile()) return;
          var video = entry.target.querySelector('.reels-shop__video');
          if (!video || entry.target.dataset.mediaType !== 'video') return;
          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            video.style.opacity = '1'; video.muted = true; play(video);
          } else {
            video.style.opacity = '0'; video.pause(); video.currentTime = 0;
          }
        });
      }, { threshold: [0, 0.5, 1], root: wrapper });
      Array.prototype.forEach.call(track.children, function (card) { mobileObserver.observe(card); });
    }

    Array.prototype.forEach.call(track.children, function (card) {
      var media = card.querySelector('.reels-shop__media');
      var video = card.querySelector('.reels-shop__video');
      var sound = card.querySelector('.reels-shop__sound');
      if (!media) return;
      if (video && card.dataset.mediaType === 'video') {
        media.addEventListener('mouseenter', function () {
          if (isMobile()) return;
          video.style.opacity = '1'; play(video);
        });
        media.addEventListener('mouseleave', function () {
          if (isMobile()) return;
          video.style.opacity = '0'; video.pause(); video.currentTime = 0;
        });
      }
      if (sound && video) {
        sound.addEventListener('click', function (e) {
          e.stopPropagation();
          video.muted = !video.muted;
          sound.classList.toggle('unmuted', !video.muted);
        });
      }
      media.style.cursor = 'pointer';
      media.addEventListener('click', function (e) {
        if (e.target.closest('.reels-shop__sound') || dragging || dragged) return;
        var url = card.dataset.ctaUrl;
        if (url && url !== '#') window.open(url, '_blank', 'noopener');
      });
    });

    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { index = clones; reset(); watchMobile(); }, 150);
    });
    if ('ResizeObserver' in window) new ResizeObserver(function () { if (!isMobile()) reset(); }).observe(wrapper);
    requestAnimationFrame(function () { requestAnimationFrame(function () { reset(); watchMobile(); }); });
    setTimeout(function () { reset(); watchMobile(); }, 200); // fallback when frames are throttled
  }

  /* Social ticker: repeat the set until it overfills the strip, then slide by one set */
  function initTicker(ticker) {
    var SPEED = 40; // px per second
    var track = ticker.querySelector('.social-editorial__ticker-track');
    if (!track) return;
    var set = Array.prototype.slice.call(track.children);
    var marker = document.createElement('span'); // zero-width end-of-set marker
    marker.setAttribute('aria-hidden', 'true');
    track.appendChild(marker);
    function fit() {
      var width = marker.offsetLeft - set[0].offsetLeft;
      if (!(width > 0)) return;
      var have = Math.round((track.children.length - 1) / set.length);
      var need = Math.ceil(ticker.clientWidth / width) + 1;
      for (; have < need; have++) {
        set.forEach(function (node) {
          var copy = node.cloneNode(true);
          copy.setAttribute('aria-hidden', 'true');
          if (copy.tagName === 'A') copy.setAttribute('tabindex', '-1');
          track.appendChild(copy);
        });
      }
      track.style.setProperty('--ticker-shift', (-width) + 'px');
      track.style.animationDuration = (width / SPEED) + 's';
    }
    fit();
    window.addEventListener('resize', fit);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  }

  /* Mobile social slideshow: cross-fade every 4s */
  function initSlideshow(carousel) {
    var slides = carousel.querySelectorAll('.social-editorial__slide');
    if (slides.length < 2) return;
    var current = 0;
    setInterval(function () {
      slides[current].classList.remove('social-editorial__slide--active');
      current = (current + 1) % slides.length;
      slides[current].classList.add('social-editorial__slide--active');
    }, 4000);
  }

  function init() {
    autoplayWhenVisible('.featured-post__video', 0.5);
    document.querySelectorAll('.reels-shop').forEach(initReels);
    document.querySelectorAll('.social-editorial__ticker').forEach(initTicker);
    document.querySelectorAll('.social-editorial__carousel').forEach(initSlideshow);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
