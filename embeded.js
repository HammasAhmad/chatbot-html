/*!
 * Fusion chatbot embed loader
 *
 * Usage on any website:
 *   <script src="https://cdn.example.com/index-v3.js" data-chatbot-id="CLIENT_98765"></script>
 *
 * Optional attributes:
 *   data-src   URL of the Next.js embed page (default: DEFAULT_APP_URL below)
 *
 * JS API on the host page:
 *   FusionChatbot.open()  FusionChatbot.close()  FusionChatbot.toggle()  FusionChatbot.destroy()
 */
(function () {
  "use strict";

  // ⬇️ Change this to your deployed Next.js app's embed route
  var DEFAULT_APP_URL = "http://localhost:3000/";

  var NS = "fusion-chatbot";
  var MOBILE_BREAKPOINT = 480;
  var CLOSED_SIZE = 100;        // launcher (60px) + 24px margins + shadow room
  var OPEN_WIDTH = 440;         // panel (370px) + 24px right margin + shadow room
  var OPEN_HEIGHT = 760;        // panel (610px) + 96px bottom offset + shadow room
  var READY_TIMEOUT = 8000;     // show the iframe anyway if the app never says "ready"

  if (window.__fusionChatbotLoaded) return;
  window.__fusionChatbotLoaded = true;

  var script =
    document.currentScript ||
    document.querySelector("script[data-chatbot-id]");

  var chatbotId = script && script.getAttribute("data-chatbot-id");
  if (!chatbotId) {
    console.error("[FusionChatbot] Missing data-chatbot-id on the <script> tag.");
    return;
  }

  var appUrl;
  try {
    appUrl = new URL(script.getAttribute("data-src") || DEFAULT_APP_URL, window.location.href);
  } catch (err) {
    console.error("[FusionChatbot] Invalid data-src URL.", err);
    return;
  }
  var appOrigin = appUrl.origin;
  appUrl.searchParams.set("chatbotId", chatbotId);
  appUrl.searchParams.set("host", window.location.origin);

  var iframe = null;
  var isReady = false;
  var isOpen = false;
  var isMobile = false;
  var queue = [];
  var readyTimer = null;
  var savedOverflow = null;

  function checkMobile() {
    return window.innerWidth <= MOBILE_BREAKPOINT;
  }

  function send(type, data) {
    var msg = Object.assign({ source: NS, type: type }, data || {});
    if (!isReady || !iframe || !iframe.contentWindow) {
      queue.push(msg);
      return;
    }
    iframe.contentWindow.postMessage(msg, appOrigin);
  }

  function flushQueue() {
    while (queue.length && iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage(queue.shift(), appOrigin);
    }
  }

  function lockHostScroll(lock) {
    var root = document.documentElement;
    if (lock && savedOverflow === null) {
      savedOverflow = root.style.overflow;
      root.style.overflow = "hidden";
    } else if (!lock && savedOverflow !== null) {
      root.style.overflow = savedOverflow;
      savedOverflow = null;
    }
  }

  function applySize() {
    if (!iframe) return;
    var s = iframe.style;
    if (!isOpen) {
      s.width = CLOSED_SIZE + "px";
      s.height = CLOSED_SIZE + "px";
      lockHostScroll(false);
    } else if (isMobile) {
      s.width = "100%";
      s.height = "100%";
      lockHostScroll(true);
    } else {
      s.width = Math.min(OPEN_WIDTH, window.innerWidth) + "px";
      s.height = Math.min(OPEN_HEIGHT, window.innerHeight) + "px";
      lockHostScroll(false);
    }
  }

  function show() {
    if (iframe) iframe.style.visibility = "visible";
  }

  function onMessage(event) {
    if (!iframe || event.source !== iframe.contentWindow) return;
    if (event.origin !== appOrigin) return;
    var data = event.data;
    if (!data || data.source !== NS) return;

    if (data.type === "ready") {
      isReady = true;
      clearTimeout(readyTimer);
      send("viewport", { isMobile: isMobile });
      flushQueue();
      show();
    } else if (data.type === "state") {
      isOpen = !!data.open;
      applySize();
    }
  }

  var resizeFrame = null;
  function onResize() {
    if (resizeFrame) return;
    resizeFrame = window.requestAnimationFrame(function () {
      resizeFrame = null;
      var nowMobile = checkMobile();
      if (nowMobile !== isMobile) {
        isMobile = nowMobile;
        send("viewport", { isMobile: isMobile });
      }
      applySize();
    });
  }

  function mount() {
    if (iframe) return;
    isMobile = checkMobile();

    iframe = document.createElement("iframe");
    iframe.src = appUrl.toString();
    iframe.title = "Chat assistant";
    iframe.setAttribute("allow", "clipboard-write");
    iframe.setAttribute("allowtransparency", "true");
    iframe.setAttribute("data-fusion-chatbot", "");
    iframe.style.cssText = [
      "position:fixed",
      "right:0",
      "bottom:0",
      "border:0",
      "margin:0",
      "padding:0",
      "background:transparent",
      "color-scheme:normal", // keeps the iframe transparent even on dark-mode host pages
      "max-width:100%",
      "max-height:100%",
      "z-index:2147483647",
      "visibility:hidden"
    ].join(";");
    applySize();

    window.addEventListener("message", onMessage);
    window.addEventListener("resize", onResize);
    document.body.appendChild(iframe);

    readyTimer = setTimeout(function () {
      if (!isReady) {
        console.warn("[FusionChatbot] Embed page did not send 'ready'. Check data-src and that /embed loads.");
        show();
      }
    }, READY_TIMEOUT);
  }

  function destroy() {
    clearTimeout(readyTimer);
    window.removeEventListener("message", onMessage);
    window.removeEventListener("resize", onResize);
    lockHostScroll(false);
    if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
    iframe = null;
    isReady = false;
    queue = [];
    window.__fusionChatbotLoaded = false;
  }

  window.FusionChatbot = {
    open: function () { send("open"); },
    close: function () { send("close"); },
    toggle: function () { send("toggle"); },
    destroy: destroy
  };

  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();