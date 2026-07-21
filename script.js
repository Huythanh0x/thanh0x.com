(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* -----------------------------------------------------------
     Footer year
  ----------------------------------------------------------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* -----------------------------------------------------------
     Terminal width — kept at least 1.2x the rendered width of
     .hero-links, since CSS has no way to size an element relative
     to a sibling's actual layout width.
  ----------------------------------------------------------- */
  (function syncTerminalWidth() {
    var heroLinks = document.querySelector(".hero-links");
    var terminal = document.getElementById("terminal");
    if (!heroLinks || !terminal) return;

    function apply() {
      var w = heroLinks.getBoundingClientRect().width;
      if (w > 0) terminal.style.minWidth = Math.round(w * 1.2) + "px";
    }

    apply();

    var resizeTimer;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(apply, 120);
    });
  })();

  /* -----------------------------------------------------------
     Terminal boot sequence
  ----------------------------------------------------------- */
  var body = document.getElementById("terminal-body");

  var LINES = [
    { type: "cmd", text: "whoami" },
    { type: "out", text: "thanh_vo_huy" },
    { type: "cmd", text: "cat role.txt" },
    { type: "out", text: "Android Developer — building mobile apps and the systems behind them" },
    { type: "cmd", text: "./gradlew :experience --years" },
    { type: "out", text: "2y native Android · 1y backend & AI systems" },
    { type: "cmd", text: "echo $STATUS" },
    { type: "out", text: "open to Android Developer roles", status: true }
  ];

  function renderStatic() {
    // Non-animated fallback (also used when reduced motion is preferred)
    var html = "";
    LINES.forEach(function (line) {
      if (line.type === "cmd") {
        html += '<p><span class="prompt">&gt;</span> ' + line.text + "</p>";
      } else {
        var cls = line.status ? "out status-line" : "out";
        html += '<p class="' + cls + '">' + line.text + (line.status ? ' <span class="cursor">▮</span>' : "") + "</p>";
      }
    });
    body.innerHTML = html;
  }

  function typeSequence() {
    body.innerHTML = "";
    var lineIndex = 0;

    function nextLine() {
      if (lineIndex >= LINES.length) return;
      var line = LINES[lineIndex];
      var p = document.createElement("p");

      if (line.type === "cmd") {
        // Each command line starts with a muted "$" while it's actively
        // typing, then flips to a green ">" the moment it finishes —
        // a simple pending -> done marker per line.
        var prompt = document.createElement("span");
        prompt.className = "prompt prompt--pending";
        prompt.textContent = "$";
        p.appendChild(prompt);
        p.appendChild(document.createTextNode(" "));
        body.appendChild(p);

        typeText(p, line.text, function () {
          prompt.classList.remove("prompt--pending");
          prompt.textContent = ">";
          lineIndex++;
          setTimeout(nextLine, 220);
        });
      } else {
        p.className = line.status ? "out status-line" : "out";
        body.appendChild(p);
        typeText(p, line.text, function () {
          if (line.status) {
            var cursor = document.createElement("span");
            cursor.className = "cursor";
            cursor.textContent = "▮";
            p.appendChild(document.createTextNode(" "));
            p.appendChild(cursor);
          }
          lineIndex++;
          setTimeout(nextLine, line.type === "out" ? 280 : 120);
        });
      }
    }

    function typeText(el, text, done) {
      // Type into a dedicated child span so we never touch el.textContent
      // directly — doing that would wipe out sibling nodes like the prompt.
      var span = document.createElement("span");
      el.appendChild(span);
      var i = 0;
      var speed = 16;
      (function step() {
        if (i <= text.length) {
          span.textContent = text.slice(0, i);
          i++;
          setTimeout(step, speed);
        } else {
          done();
        }
      })();
    }

    nextLine();
  }

  var terminalStarted = false;
  function lockTerminalHeight() {
    // Render the final content once, off-screen from the animation's
    // perspective, purely to measure its natural height — then lock that
    // in as a floor so the box doesn't grow line-by-line as text types in.
    renderStatic();
    var finalHeight = body.scrollHeight;
    body.style.minHeight = finalHeight + "px";
  }

  function startTerminal() {
    if (terminalStarted || !body) return;
    terminalStarted = true;
    if (reduceMotion) {
      renderStatic();
    } else {
      lockTerminalHeight();
      typeSequence();
    }
  }

  /* -----------------------------------------------------------
     View switch (Android / Backend hero)
  ----------------------------------------------------------- */
  var VIEW_KEY = "thanh0x-hero-view";
  var VALID_VIEWS = ["mobile", "backend"];
  var viewButtons = document.querySelectorAll(".view-switch-btn");
  var heroViews = document.querySelectorAll(".hero-view");

  function setView(view, persist) {
    heroViews.forEach(function (el) {
      el.classList.toggle("is-hidden", el.getAttribute("data-view") !== view);
    });
    viewButtons.forEach(function (btn) {
      var isActive = btn.getAttribute("data-view") === view;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
    if (view === "backend") startTerminal();
    if (persist !== false) {
      try { localStorage.setItem(VIEW_KEY, view); } catch (e) { /* storage unavailable, ignore */ }
    }
  }

  function getUrlView() {
    // Lets a shared link force a specific default view, e.g.
    // https://thanh0x.com/?view=backend or ?view=mobile
    try {
      var params = new URLSearchParams(window.location.search);
      var v = params.get("view");
      if (VALID_VIEWS.indexOf(v) !== -1) return v;
    } catch (e) { /* URLSearchParams unavailable, ignore */ }
    return null;
  }

  if (viewButtons.length) {
    viewButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        setView(btn.getAttribute("data-view"));
      });
    });

    var urlView = getUrlView();
    var savedView = "mobile";
    try { savedView = localStorage.getItem(VIEW_KEY) || "mobile"; } catch (e) { /* default to mobile */ }
    var initialView = urlView || (savedView === "backend" ? "backend" : "mobile");
    // Initial load never overwrites the visitor's own saved preference —
    // only an explicit click on the switch does that.
    setView(initialView, false);
  }

  /* -----------------------------------------------------------
     Mobile nav toggle
  ----------------------------------------------------------- */
  var navEl = document.getElementById("nav");
  var toggleBtn = document.getElementById("nav-toggle");
  var navLinks = document.getElementById("nav-links");

  if (toggleBtn && navLinks && navEl) {
    toggleBtn.addEventListener("click", function () {
      var isOpen = navLinks.classList.toggle("open");
      navEl.classList.toggle("menu-open", isOpen);
      toggleBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    navLinks.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        navLinks.classList.remove("open");
        navEl.classList.remove("menu-open");
        toggleBtn.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* -----------------------------------------------------------
     Scroll reveal for sections
  ----------------------------------------------------------- */
  var sections = document.querySelectorAll(".section");
  if ("IntersectionObserver" in window && !reduceMotion) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    sections.forEach(function (s) { observer.observe(s); });
  } else {
    sections.forEach(function (s) { s.classList.add("is-visible"); });
  }

  /* -----------------------------------------------------------
     Active nav link tracking
  ----------------------------------------------------------- */
  var navAnchors = document.querySelectorAll("[data-nav]");
  var idToAnchor = {};
  navAnchors.forEach(function (a) {
    idToAnchor[a.getAttribute("href").slice(1)] = a;
  });

  if ("IntersectionObserver" in window) {
    var navObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          var anchor = idToAnchor[entry.target.id];
          if (!anchor) return;
          if (entry.isIntersecting) {
            navAnchors.forEach(function (a) { a.classList.remove("active"); });
            anchor.classList.add("active");
          }
        });
      },
      { rootMargin: "-45% 0px -45% 0px" }
    );
    Object.keys(idToAnchor).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) navObserver.observe(el);
    });
  }
})();
