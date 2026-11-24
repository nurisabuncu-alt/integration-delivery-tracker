(function () {
  "use strict";

  var CLIENT_ID = "201499874435-9dbdm35evu2gkn6flcji9bvroqsgvote.apps.googleusercontent.com";
  var ALLOWED_DOMAIN = "logiwa.com";
  var STORAGE_KEY = "integration-delivery-google-credential";
  var ISSUERS = ["accounts.google.com", "https://accounts.google.com"];

  var script = document.currentScript;
  var appSrc = script && script.getAttribute("data-app");
  var gate = document.getElementById("authGate");
  var message = document.getElementById("authMessage");
  var buttonHost = document.getElementById("authButton");
  var appLoaded = false;

  function decodePayload(credential) {
    var parts = String(credential || "").split(".");
    if (parts.length !== 3) return null;
    try {
      var base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      while (base64.length % 4) base64 += "=";
      var json = decodeURIComponent(
        atob(base64)
          .split("")
          .map(function (char) {
            return "%" + ("00" + char.charCodeAt(0).toString(16)).slice(-2);
          })
          .join("")
      );
      return JSON.parse(json);
    } catch (error) {
      return null;
    }
  }

  // Returns { ok: true, email, name } or { ok: false, reason }.
  function check(credential) {
    var payload = decodePayload(credential);
    if (!payload) return { ok: false, reason: "Sign-in response was not valid." };
    if (payload.aud !== CLIENT_ID) return { ok: false, reason: "Sign-in response was for a different app." };
    if (ISSUERS.indexOf(payload.iss) < 0) return { ok: false, reason: "Sign-in response was not from Google." };
    if (!payload.exp || payload.exp * 1000 <= Date.now()) return { ok: false, reason: "Your sign-in expired. Sign in again." };
    var email = String(payload.email || "").toLowerCase();
    if (payload.email_verified !== true || !email) return { ok: false, reason: "That Google account has no verified email." };
    if (!email.endsWith("@" + ALLOWED_DOMAIN) || payload.hd !== ALLOWED_DOMAIN) {
      return { ok: false, reason: email + " is not allowed. Sign in with your @" + ALLOWED_DOMAIN + " account." };
    }
    return { ok: true, email: email, name: payload.name || email };
  }

  function setMessage(text) {
    if (message) message.textContent = text || "";
  }

  function addSessionChip(profile) {
    var chip = document.createElement("div");
    chip.className = "auth-chip";
    var label = document.createElement("span");
    label.textContent = profile.email;
    var out = document.createElement("button");
    out.type = "button";
    out.textContent = "Sign out";
    out.addEventListener("click", function () {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        /* Nothing stored. */
      }
      if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect();
      location.reload();
    });
    chip.appendChild(label);
    chip.appendChild(out);
    document.body.appendChild(chip);
  }

  function unlock(profile) {
    document.body.classList.remove("auth-locked");
    if (gate) gate.hidden = true;
    addSessionChip(profile);
    if (appLoaded || !appSrc) return;
    appLoaded = true;
    var app = document.createElement("script");
    app.src = appSrc;
    document.body.appendChild(app);
  }

  function onCredential(response) {
    var credential = response && response.credential;
    var result = check(credential);
    if (!result.ok) {
      setMessage(result.reason);
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, credential);
    } catch (error) {
      /* Sign-in still works for this page view. */
    }
    unlock(result);
  }

  function showSignIn(attempt) {
    if (window.google && google.accounts && google.accounts.id) {
      google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: onCredential,
        auto_select: true,
        hd: ALLOWED_DOMAIN,
      });
      google.accounts.id.renderButton(buttonHost, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "signin_with",
        shape: "rectangular",
        width: 280,
      });
      google.accounts.id.prompt();
      return;
    }
    if (attempt > 150) {
      setMessage("Google sign-in could not load. Check your connection and reload the page.");
      return;
    }
    setTimeout(function () {
      showSignIn(attempt + 1);
    }, 100);
  }

  var stored = "";
  try {
    stored = localStorage.getItem(STORAGE_KEY) || "";
  } catch (error) {
    stored = "";
  }
  if (stored) {
    var saved = check(stored);
    if (saved.ok) {
      unlock(saved);
      return;
    }
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      /* Nothing to clear. */
    }
    setMessage(saved.reason);
  }
  showSignIn(0);
})();
