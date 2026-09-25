"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const vm = require("node:vm");
const { describe, test } = require("node:test");

const ROOT = __dirname;
const V2_FROZEN_DIGEST = "7ccae004a2ab2b16b42b14c37e5f0fdf2f8d6e323bc0890a3cc6aafd84e884e1";
const FROZEN_FILES = Object.freeze([
  ".gitignore", "api-client.js", "app.js", "config.js", "device-session-store.js", "firebase.json",
  "functions/index.js", "functions/package-lock.json", "functions/package.json",
  "functions/src/app.js", "functions/src/device-sessions.js", "functions/src/rate-limit.js",
  "functions/src/security.js", "functions/src/sheets-mapper.js", "functions/src/sheets-reader.js",
  "functions/src/sheets-writer.js", "functions/src/teacher-update.js", "functions/src/teachers.js",
  "functions/src/write-lock.js", "functions/test/api.test.js", "functions/test/auth-fixture.js",
  "functions/test/device-session-api.test.js", "functions/test/device-session-frontend.test.js",
  "functions/test/device-sessions.test.js", "functions/test/frontend-simulation.test.js",
  "functions/test/sheets-mapper.test.js", "functions/test/sheets-reader.test.js",
  "functions/test/sheets-writer.test.js", "functions/test/teacher-update-api.test.js",
  "functions/test/teacher-update.test.js", "functions/test/teacher-write-api.test.js",
  "functions/test/write-lock.test.js", "functions/test/write-wiring.test.js",
  "icons/apple-touch-icon.png", "icons/icon-192.png", "icons/icon-512.png",
  "icons/icon-maskable-192.png", "icons/icon-maskable-512.png", "mock-data.js", "styles.css"
]);
const {
  canonicalInstallUrl,
  classifyInstallEnvironment,
  installGuideFor,
  shouldShowInstallButton
} = require("./pwa.js");

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}

function pngDimensions(file) {
  const data = fs.readFileSync(path.join(ROOT, file));
  assert.equal(data.subarray(1, 4).toString("ascii"), "PNG");
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

describe("Gate 5 PWA manifest and metadata", () => {
  test("manifest 使用 production scope/start URL 與指定品牌色", () => {
    const manifest = JSON.parse(read("manifest.webmanifest"));
    assert.equal(manifest.name, "義學 LINE 查詢");
    assert.equal(manifest.short_name, "義學LINE");
    assert.equal(manifest.start_url, "/school-tools/");
    assert.equal(manifest.scope, "/school-tools/");
    assert.equal(manifest.display, "standalone");
    assert.equal(manifest.theme_color, "#02773c");
    assert.equal(manifest.background_color, "#ffffff");
    assert.deepEqual(manifest.icons.map((icon) => [icon.src, icon.sizes, icon.purpose]), [
      ["icons/icon-192.png", "192x192", "any"],
      ["icons/icon-512.png", "512x512", "any"],
      ["icons/icon-maskable-192.png", "192x192", "maskable"],
      ["icons/icon-maskable-512.png", "512x512", "maskable"]
    ]);
  });

  test("五個 PNG 尺寸正確", () => {
    for (const [file, size] of [
      ["icons/icon-192.png", 192],
      ["icons/icon-512.png", 512],
      ["icons/icon-maskable-192.png", 192],
      ["icons/icon-maskable-512.png", 512],
      ["icons/apple-touch-icon.png", 180]
    ]) {
      assert.deepEqual(pngDimensions(file), { width: size, height: size });
    }
  });

  test("HTML 含 manifest、Android/iOS metadata、viewport-fit 與唯一品牌 Footer", () => {
    const html = read("index.html");
    assert.match(html, /rel="manifest" href="manifest\.webmanifest"/);
    assert.match(html, /apple-mobile-web-app-capable" content="yes"/);
    assert.match(html, /apple-mobile-web-app-status-bar-style" content="default"/);
    assert.match(html, /apple-mobile-web-app-title" content="義學LINE"/);
    assert.match(html, /rel="apple-touch-icon" sizes="180x180"/);
    assert.match(html, /viewport-fit=cover/);
    assert.match(html, /meta name="description" content="義學國中 LINE 帳號查詢與自填系統"/);
    assert.doesNotMatch(html, /V2 測試介面|staging|測試站|\/school-tools-v2\//i);
    assert.equal((html.match(/Made by WenYi/g) || []).length, 1);
  });
});

describe("Gate 5 Header branding", () => {
  test("使用既有正式 App icon 且不再顯示通訊錄 icon", () => {
    const html = read("index.html");
    assert.match(html, /<img class="logo-icon" src="icons\/icon-192\.png"/);
    assert.doesNotMatch(html, /fa-address-book/);
    assert.match(html, /義學國中 LINE 帳號查詢/);
    assert.match(html, /一鍵放桌面・下次直接查/);
  });
});
describe("Gate 5 visible install experience", () => {
  const androidChrome = classifyInstallEnvironment({
    userAgent: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36",
    vendor: "Google Inc."
  });
  const iphoneSafari = classifyInstallEnvironment({
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
    vendor: "Apple Computer, Inc."
  });

  test("Header 含安裝按鈕、icon、引導 dialog 與 production canonical URL", () => {
    const html = read("index.html");
    assert.match(html, /id="btnInstallApp"[^>]*hidden/);
    assert.match(html, /fa-solid fa-download/);
    assert.match(html, />\s*<i[^>]+><\/i>\s*一鍵放桌面・下次直接查\s*</);
    assert.match(html, /class="install-helper">免翻 LINE、免找連結<\/p>/);
    assert.match(html, /id="installOverlay"/);
    assert.match(html, /id="btnCopyInstallUrl"/);
    assert.match(html, /rel="canonical" href="https:\/\/easyshih-ux\.github\.io\/school-tools\/"/);
  });

  test("Android Chrome 有 native prompt 時直接安裝，尚無 event 時仍提供說明", () => {
    assert.equal(androidChrome.kind, "android-chrome");
    assert.equal(shouldShowInstallButton(androidChrome, true, false), true);
    assert.equal(shouldShowInstallButton(androidChrome, false, false), true);
    assert.match(installGuideFor(androidChrome), /Chrome.*安裝應用程式|Chrome.*加到主畫面/);
    const script = read("pwa.js");
    assert.match(script, /beforeinstallprompt/);
    assert.match(script, /await prompt\.prompt\(\)/);
  });

  test("iPhone Safari 顯示指定加入主畫面教學", () => {
    assert.equal(iphoneSafari.kind, "ios-safari");
    assert.equal(shouldShowInstallButton(iphoneSafari, false, false), true);
    assert.equal(installGuideFor(iphoneSafari), "點選 Safari「分享」→「加入主畫面」");
  });

  test("LINE/in-app browser 顯示平台引導及複製 production URL", () => {
    const androidLine = classifyInstallEnvironment({
      userAgent: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36 Line/15.0.0",
      vendor: "Google Inc."
    });
    const iosLine = classifyInstallEnvironment({
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Line/15.0.0"
    });
    assert.equal(androidLine.kind, "in-app");
    assert.equal(iosLine.kind, "in-app");
    assert.match(installGuideFor(androidLine), /Chrome/);
    assert.match(installGuideFor(iosLine), /Safari/);
    assert.equal(canonicalInstallUrl({ origin: "https://easyshih-ux.github.io" }), "https://easyshih-ux.github.io/school-tools/");
    assert.match(read("pwa.js"), /navigatorObject\.clipboard\.writeText\(url\)/);
  });

  test("standalone 隱藏；desktop 僅在瀏覽器提供 native prompt 時顯示", () => {
    const desktop = classifyInstallEnvironment({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36",
      vendor: "Google Inc."
    });
    assert.equal(desktop.kind, "desktop-or-unsupported");
    assert.equal(shouldShowInstallButton(androidChrome, true, true), false);
    assert.equal(shouldShowInstallButton(desktop, false, false), false);
    assert.equal(shouldShowInstallButton(desktop, true, false), true);
  });
});
describe("Gate 5 service worker safety", () => {
  const worker = read("sw.js");

  test("production cache 使用 school-tools 專用 namespace", () => {
    assert.match(worker, /CACHE_NAMESPACE = "school-tools-shell-"/);
    assert.match(worker, /CACHE_VERSION = .*CACHE_NAMESPACE.*v2/);
    assert.match(worker, /key\.startsWith\(CACHE_NAMESPACE\) && key !== CACHE_VERSION/);
  });

  test("activate 只清除舊 school-tools cache，保留 current 與 unrelated cache", async () => {
    let activateHandler;
    let pending;
    const deleted = [];
    const context = {
      URL,
      fetch: async () => { throw new Error("fetch should not run during activate"); },
      caches: {
        keys: async () => [
          "school-tools-shell-v0",
          "school-tools-shell-v1",
          "school-tools-v2-shell-v3",
          "parent-day-map",
          "another-project-cache"
        ],
        delete: async (key) => { deleted.push(key); return true; },
        open: async () => ({ addAll: async () => undefined })
      },
      self: {
        addEventListener: (type, handler) => { if (type === "activate") activateHandler = handler; },
        skipWaiting: () => undefined,
        clients: { claim: () => undefined },
        location: { origin: "https://easyshih-ux.github.io" }
      }
    };
    vm.runInNewContext(worker, context);
    activateHandler({ waitUntil: (promise) => { pending = promise; } });
    await pending;
    assert.deepEqual(deleted, ["school-tools-shell-v0", "school-tools-shell-v1"]);
  });

  test("API、跨 origin、非 GET request 完全 bypass", () => {
    assert.match(worker, /request\.method !== "GET"\) return/);
    assert.match(worker, /url\.origin !== self\.location\.origin \|\| isSensitiveApiPath/);
    assert.match(worker, /"\/auth\/session"/);
    assert.match(worker, /"\/auth\/refresh"/);
    assert.match(worker, /"\/auth\/logout"/);
    assert.match(worker, /"\/teachers"/);
    const staticBlock = worker.slice(worker.indexOf("const STATIC_ASSETS"), worker.indexOf("]);", worker.indexOf("const STATIC_ASSETS")) + 3);
    assert.doesNotMatch(staticBlock, /auth\/session|teachers|cloudfunctions/);
  });

  test("只 cache 明列公開 shell 且 network-first no-cache", () => {
    assert.match(worker, /STATIC_ASSETS\.includes\(url\.pathname\)/);
    assert.match(worker, /fetch\(request, \{ cache: "no-cache" \}\)/);
    const staticBlock = worker.slice(worker.indexOf("const STATIC_ASSETS"), worker.indexOf("]);", worker.indexOf("const STATIC_ASSETS")) + 3);
    assert.doesNotMatch(staticBlock, /apiSession|Authorization|Bearer|teacher/);
  });
});

describe("Gate 5 frozen boundary and Pages artifact", () => {
  test("非 migration 檔案與 V2 candidate frozen tree 完全一致", () => {
    const hash = crypto.createHash("sha256");
    for (const file of FROZEN_FILES) {
      hash.update(file);
      hash.update("\0");
      hash.update(fs.readFileSync(path.join(ROOT, file)));
      hash.update("\0");
    }
    assert.equal(hash.digest("hex"), V2_FROZEN_DIGEST);
  });

  test("Pages workflow 只加入 PWA 靜態資產", () => {
    const workflow = read(".github/workflows/pages.yml");
    for (const asset of ["device-session-store.js", "pwa.js", "sw.js", "manifest.webmanifest", "icons"]) {
      assert.match(workflow, new RegExp(asset.replace(".", "\\.")));
    }
    assert.doesNotMatch(workflow, /functions\/|\.env|secret/i);
  });
});
