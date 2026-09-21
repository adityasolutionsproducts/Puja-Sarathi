/* ═══════════════════════════════════════════════════════════════════════
   Puja Sarathi — native Android bridge (Capacitor)
   Loaded by index.html; every API is a no-op in a plain browser, so the same
   file keeps working on the web/PWA build.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function cap() {
    try { return (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) ? window.Capacitor : null; }
    catch (_) { return null; }
  }
  function plug(n) {
    const c = cap();
    return (c && c.Plugins && c.Plugins[n]) || null;
  }
  function isNative() { return !!cap(); }
  function L2(bn, en) {
    try { return (typeof window.L2 === 'function') ? window.L2(bn, en) : en; }
    catch (_) { return en; }
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }
  function T(msg, type, opts) {
    try { if (typeof toast === 'function') toast(msg, type || 'info', opts); } catch (_) {}
  }

  /* ─────────────── snackbar with action button ("Open") ─────────────── */
  let _snackTimer = null;
  function snack(messageHtml, actionLabel, onAction, ms) {
    let sb = document.getElementById('psn-snack');
    if (!sb) {
      sb = document.createElement('div');
      sb.id = 'psn-snack';
      sb.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:86px;z-index:99999;display:none;align-items:center;gap:14px;background:#0f172a;color:#fff;padding:11px 16px;border-radius:12px;font-size:13px;font-weight:600;box-shadow:0 10px 30px rgba(0,0,0,.35);max-width:min(92vw,520px)';
      document.body.appendChild(sb);
    }
    sb.innerHTML = '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + messageHtml + '</span>';
    if (actionLabel) {
      const b = document.createElement('button');
      b.textContent = actionLabel;
      b.style.cssText = 'background:transparent;border:0;color:#fbbf24;font-weight:800;font-size:13px;cursor:pointer;padding:4px 2px;flex:0 0 auto';
      b.onclick = () => { hideSnack(); try { onAction && onAction(); } catch (_) {} };
      sb.appendChild(b);
    }
    sb.style.display = 'flex';
    clearTimeout(_snackTimer);
    _snackTimer = setTimeout(hideSnack, ms || 7000);
  }
  function hideSnack() {
    const sb = document.getElementById('psn-snack');
    if (sb) sb.style.display = 'none';
  }

  /* ─────────────── save files into Documents/Puja Sarathi/<dir> ─────────────── */
  function announceSaved(res) {
    try { T(L2('সেভ হয়েছে ✓ ', 'Saved ✓ ') + (res.path || res.name), 'ok'); } catch (_) {}
    const NB = plug('NativeBridge');
    if (!NB) return;
    snack(
      esc(res.path || res.name),
      L2('খুলুন', 'Open'),
      function () { NB.openFile({ uri: res.uri, mime: res.mime, name: res.name }).catch(function () {}); }
    );
  }

  async function saveFile(fileName, data, opts) {
    const o = opts || {};
    const NB = plug('NativeBridge');
    if (!NB) {
      T(L2('নেটিভ সেভ ব্রিজ পাওয়া যায়নি — অ্যাপ আপডেট করুন', 'Native save bridge unavailable — please update the app'), 'err', { duration: 6000 });
      return null;
    }
    const res = await NB.saveFile({ fileName: fileName, data: data, base64: !!o.base64, dir: o.dir || 'Report' });
    announceSaved(res);
    return res;
  }

  /* ─────────────── PDF (jsPDF + html2canvas, bundled offline) ───────────────
     The two libraries ship inside the APK (www/vendor/) so exports work with
     no network; the CDN is only a fallback for the web/PWA build. */
  let _pdfLibsPromise = null;
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('load failed: ' + src));
      document.head.appendChild(s);
    });
  }
  function ensurePdfLibs() {
    if (_pdfLibsPromise) return _pdfLibsPromise;
    _pdfLibsPromise = new Promise((resolve, reject) => {
      if (window.jspdf && window.jspdf.jsPDF && window.html2canvas) { resolve(); return; }
      // Prefer bundled copies (work offline inside the APK), CDN as fallback
      loadScript('vendor/jspdf.umd.min.js')
        .then(() => loadScript('vendor/html2canvas.min.js'))
        .catch(() => loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')
          .then(() => loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js')))
        .then(() => {
          if (window.jspdf && window.jspdf.jsPDF && window.html2canvas) resolve();
          else reject(new Error('PDF libraries unavailable'));
        })
        .catch(reject);
    });
    return _pdfLibsPromise;
  }

  /* Print-style rules applied only inside the off-screen PDF holder.
     The #psnPrint ID gives enough specificity to beat the app's dark-theme
     .print-area overrides, so the PDF always comes out clean black-on-white. */
  const PRINT_CSS =
    '#psnPrint{background:#ffffff !important;}' +
    '#psnPrint .print-area{background:#ffffff !important; border-color:#dbe2ec !important;}' +
    '#psnPrint .print-area *{color:#000 !important; background:transparent !important; box-shadow:none !important; text-shadow:none !important; border-color:#cbd5e1 !important;}' +
    '#psnPrint .print-area .pill{border:1px solid #cbd5e1 !important; padding:1px 7px !important; background:transparent !important;}' +
    '#psnPrint .print-area .bar{border:1px solid #cbd5e1 !important; height:8px; background:transparent !important;}' +
    '#psnPrint .print-area .bar > div{background:#b45309 !important;}' +
    '#psnPrint .print-area table{width:100%; border-collapse:collapse; font-size:11px;}' +
    '#psnPrint .print-area thead th{background:#f1f5f9 !important; -webkit-print-color-adjust:exact; print-color-adjust:exact;}' +
    '#psnPrint .print-area th,#psnPrint .print-area td{padding:6px 7px !important; border-bottom:1px solid #e2e8f0;}' +
    '#psnPrint .print-area tr{page-break-inside:avoid; break-inside:avoid;}' +
    '#psnPrint .print-area .pdf-ok{color:#047857 !important;}' +
    '#psnPrint .print-area .pdf-bad{color:#b91c1c !important;}' +
    '#psnPrint .print-area .pdf-mut{color:#475569 !important;}' +
    '#psnPrint .print-area .pdf-title{border-bottom:1.5px solid #0f172a !important;}';

  /* Standalone HTML document for the native print-engine renderer. The off-screen
     WebView doesn't inherit the app's stylesheets, so we inline a compact
     print stylesheet + CSS-variable fallbacks (the report HTML references
     var(--brand-*) and classes like .pill / .pdf-ok). */
  const PDF_DOC_CSS =
    ':root{--brand-050:#fffbeb;--brand-100:#fef3c7;--brand-200:#fde68a;--brand-300:#fcd34d;--brand-400:#fbbf24;--brand-500:#f59e0b;--brand-600:#d97706;--brand-700:#b45309;--brand-800:#92400e;--brand-900:#422006;--brand-deep:#c2410c;--line:#e2e8f0;--muted:#64748b;--faint:#94a3b8;--ink:#0f172a;--bg-2:#f8fafc;}' +
    'html,body{margin:0;padding:0;background:#ffffff;}' +
    'body{font-family:\'Noto Sans Bengali\',\'Noto Sans\',system-ui,-apple-system,sans-serif;color:#0f172a;width:794px;box-sizing:border-box;padding:24px 26px;}' +
    '.pill{display:inline-block;padding:2px 9px;border:1px solid #cbd5e1;border-radius:999px;font-size:10px;font-weight:700;white-space:nowrap;background:transparent;}' +
    '.card{background:#ffffff !important;}' +
    '.print-area{background:#ffffff !important;}' +
    '.pdf-ok{color:#047857 !important;}.pdf-bad{color:#b91c1c !important;}.pdf-mut{color:#475569 !important;}' +
    '.pdf-title{border-bottom:1.5px solid #0f172a !important;}' +
    '.rp-meta{border-top:1px solid #cbd5e1 !important;border-bottom:1px solid #cbd5e1 !important;}' +
    '.bar{border:1px solid #cbd5e1 !important;height:8px;background:transparent !important;}.bar>div{background:#b45309 !important;}' +
    'table{page-break-inside:auto;}tr{page-break-inside:avoid;break-inside:avoid;}thead{display:table-header-group;}' +
    'img,svg{max-width:100%;}';
  function buildStandaloneHtml(innerHtml) {
    return '<!DOCTYPE html><html lang="bn"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=794">' +
      '<style>@page{size:A4;margin:0;}</style>' +
      '<style>' + PDF_DOC_CSS + '</style>' +
      '</head><body>' + innerHtml + '</body></html>';
  }

  async function saveSheetAsPdf(innerHtml, fileTitle, dir) {
    const name = String(fileTitle || 'puja-sarathi').replace(/[\\/:*?"<>|]+/g, '-') + '.pdf';
    /* 1st choice: native Blink print-to-PDF — vector output, ~1s, no big canvas.
       Falls back to html2canvas only if the bridge rejects (old APK). */
    const NB = plug('NativeBridge');
    if (NB && NB.renderPdf) {
      try {
        T(L2('PDF তৈরি হচ্ছে…', 'Creating PDF…'), 'info');
        const res = await NB.renderPdf({ html: buildStandaloneHtml(innerHtml), fileName: name, dir: dir || 'Report' });
        announceSaved(res);
        return res;
      } catch (e) {
        try { console.warn('[Puja Sarathi] native renderPdf failed, using canvas fallback:', e); } catch (_) {}
      }
    }
    try {
      T(L2('PDF তৈরি হচ্ছে…', 'Creating PDF…'), 'info');
      await ensurePdfLibs();
      try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (_) {}
      // Off-screen A4 sheet (~794px @96dpi) rendered behind the app UI
      const holder = document.createElement('div');
      holder.id = 'psnPrint';
      holder.className = 'pdf-sheet';
      holder.setAttribute('style', 'position:absolute;left:0;top:0;width:794px;background:#ffffff;z-index:-9999;overflow:hidden');
      holder.innerHTML = '<style>' + PRINT_CSS + '</style>' + innerHtml;
      document.body.appendChild(holder);
      let canvas;
      try {
        // conservative scale/cap: canvas memory is what crashed long exports
        let scale = 1.5;
        const h = holder.scrollHeight || 1123;
        if (h * scale > 6000) scale = Math.max(1, 6000 / h);
        canvas = await window.html2canvas(holder, { scale: scale, backgroundColor: '#ffffff', useCORS: true, logging: false, windowWidth: 794 });
      } finally {
        try { holder.remove(); } catch (_) {}
      }
      const JsPDF = window.jspdf.jsPDF;
      const pdf = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      const pw = 210, ph = 297;
      const imgH = canvas.height * pw / canvas.width;
      const img = canvas.toDataURL('image/jpeg', 0.9);
      let offset = 0, page = 0;
      while (offset < imgH - 1) {
        if (page > 0) pdf.addPage();
        pdf.addImage(img, 'JPEG', 0, -offset, pw, imgH, undefined, 'FAST');
        offset += ph; page++;
      }
      const b64 = pdf.output('datauristring').split(',')[1] || '';
      const res = await saveFile(name, b64, { base64: true, dir: dir || 'Report' });
      if (!res) throw new Error('native bridge unavailable');
    } catch (e) {
      try { console.error('[Puja Sarathi] PDF export failed:', e); } catch (_) {}
      T(L2('PDF সেভ করা যায়নি: ', 'Could not save PDF: ') + (e && e.message ? e.message : e), 'err', { duration: 6000 });
    }
  }

  /* helper: Blob → base64 (preserves BOM / binary exactly) */
  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result).split(',')[1] || '');
      fr.onerror = () => reject(new Error('read failed'));
      fr.readAsDataURL(blob);
    });
  }

  /* ─────────────── invite QR code ───────────────
     Renders the invite deep link as a QR (davidshimjs qrcodejs, bundled
     offline in vendor/). Scanning it from the Create-account page's scan
     button fills the invite code automatically. */
  let _qrLibsPromise = null;
  function ensureQrLibs() {
    if (_qrLibsPromise) return _qrLibsPromise;
    _qrLibsPromise = new Promise((resolve, reject) => {
      if (window.QRCode) { resolve(); return; }
      loadScript('vendor/qrcode.min.js')
        .catch(() => loadScript('https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'))
        .then(() => { if (window.QRCode) resolve(); else reject(new Error('QR library unavailable')); })
        .catch(reject);
    });
    return _qrLibsPromise;
  }
  async function showQr(code, title) {
    code = String(code || '').trim().toUpperCase();
    if (!code) { T(L2('আগে invite কোড বানান', 'Generate an invite code first'), 'warn'); return; }
    const text = inviteLink(code) || ('pujasarathi://join?code=' + encodeURIComponent(code));
    const body = '<div style="display:grid; place-items:center; gap:10px; padding:6px 2px">'
      + '<div id="psnQrBox" style="background:#ffffff; border:1px solid #e2e8f0; border-radius:14px; padding:14px"></div>'
      + '<b style="letter-spacing:1.5px; font-size:16px">' + esc(code) + '</b>'
      + '<div style="font-size:11.5px; color:#64748b; text-align:center; max-width:300px">' + esc(L2('অ্যাকাউন্ট তৈরির পেজে স্ক্যান বাটন দিয়ে এই QR স্ক্যান করলে কোড নিজেই বসে যাবে', 'On the Create account page, tap the scan button and scan this QR — the code fills in automatically')) + '</div>'
      + '</div>';
    try {
      if (typeof openModal === 'function') openModal(title || L2('Invite QR কোড', 'Invite QR code'), body);
      else { T(L2('QR দেখানো যাবে না', 'Cannot show QR'), 'err'); return; }
    } catch (_) { return; }
    try {
      await ensureQrLibs();
      const box = document.getElementById('psnQrBox');
      if (!box) return;
      new window.QRCode(box, { text: text, width: 230, height: 230, colorDark: '#0f172a', colorLight: '#ffffff', correctLevel: window.QRCode.CorrectLevel.M });
    } catch (e) {
      T(L2('QR তৈরি করা যায়নি: ', 'Could not create QR: ') + (e && e.message ? e.message : e), 'err');
    }
  }

  /* ─────────────── status bar follows the live accent color ─────────────── */
  function syncStatusBar() {
    const SB = plug('StatusBar');
    if (!SB) return;
    let hex = '#D97706';
    try {
      const m = document.querySelector('meta[name="theme-color"]');
      const raw = m ? (m.getAttribute('content') || '') : '';
      if (/^#[0-9a-fA-F]{6}$/.test(raw)) hex = raw;
      else {
        const cs = (getComputedStyle(document.documentElement).getPropertyValue('--brand-600') || '').trim();
        if (/^#[0-9a-fA-F]{6}$/.test(cs)) hex = cs;
      }
    } catch (_) {}
    try { const p0 = SB.setOverlaysWebView({ overlay: false }); if (p0 && p0.catch) p0.catch(function () {}); } catch (_) {}
    try { const p = SB.setStyle({ style: 'Dark' }); if (p && p.catch) p.catch(function () {}); } catch (_) {}
    try { const p2 = SB.setBackgroundColor({ color: hex }); if (p2 && p2.catch) p2.catch(function () {}); } catch (_) {}
  }

  /* ─────────────── safe-area note ───────────────
     styles.xml opts out of Android 15's enforced edge-to-edge, so the WebView
     starts BELOW the status bar. We deliberately do NOT add
     env(safe-area-inset-top) padding here: on Samsung devices the WebView
     reports the display-cutout inset even when not overlaid, which produced a
     big empty strip under the status bar. If a future targetSdk re-enables
     edge-to-edge, bridge real insets from native instead. */
  /* ─────────────── notifications (channel + POST_NOTIFICATIONS + tray icon) ─────────────── */
  const NOTIF_CHANNEL_ID = 'orders_and_reminders';
  function initNotifications() {
    const LN = plug('LocalNotifications');
    if (!LN) return;
    (async () => {
      try {
        await LN.createChannel({
          id: NOTIF_CHANNEL_ID,
          name: L2('রিমাইন্ডার ও আপডেট', 'Orders and reminders'),
          description: L2('পূজা রিমাইন্ডার ও গুরুত্বপূর্ণ আপডেট', 'Puja reminders and important updates'),
          importance: 5,
          visibility: 'PUBLIC'
        });
      } catch (_) {}
      try {
        const st = await LN.checkPermissions();
        if (!st || st.display !== 'granted') await LN.requestPermissions();
      } catch (_) {}
    })();
  }

  /* Post a real Android status-bar notification.
     smallIcon = monochrome white-alpha app-icon silhouette (ic_stat_notify),
     largeIcon = full-color app icon in the expanded view. */
  function notify(title, body) {
    const LN = plug('LocalNotifications');
    if (!LN) return;
    (async () => {
      try {
        await LN.schedule({
          notifications: [{
            id: Math.floor(Math.random() * 2000000000) + 1,
            channelId: NOTIF_CHANNEL_ID,
            title: String(title || L2('পূজা সারথি', 'Puja Sarathi')),
            body: String(body || ''),
            smallIcon: 'ic_stat_notify',
            largeIcon: 'icons/icon-512.png'
          }]
        });
      } catch (_) {}
    })();
  }

  /* ─────────────── hardware back button ─────────────── */
  let _lastBackAt = 0;
  function initBackButton() {
    const App = plug('App');
    if (!App || !App.addListener) return;
    try {
      App.addListener('backButton', function () {
        try {
          // 1) openModal() dialog
          const m = document.getElementById('modal');
          if (m) { if (typeof closeModal === 'function') closeModal(); else m.remove(); return; }
          // 2) app's own confirm/alert/prompt dialogs — trigger their Cancel
          const dlg = document.querySelector('.uidlg');
          if (dlg) {
            const no = dlg.querySelector('[data-ui="no"]');
            if (no) { no.click(); return; }
            dlg.click(); // backdrop-click resolves as cancel
            return;
          }
          // 3) notification side panel
          const np = document.getElementById('notifPanel');
          if (np && np.classList.contains('open')) {
            if (typeof window.openNotifPanel === 'function') window.openNotifPanel(false);
            else np.classList.remove('open');
            return;
          }
          // 4) feature drawer
          const dr = document.getElementById('drawer');
          if (dr && dr.classList.contains('open')) {
            const b = document.getElementById('menuBtn');
            if (b) b.click();
            return;
          }
          // 5) any non-home screen → home
          const r = (typeof state !== 'undefined' && state && state.route) ? state.route : '/';
          if (['/', '/dashboard'].indexOf(r) < 0) {
            if (typeof state !== 'undefined' && state) {
              state.route = '/';
              if (typeof render === 'function') render();
            }
            return;
          }
          // 6) on home — double-press-to-exit
          const now = Date.now();
          if (now - _lastBackAt < 2200) { App.exitApp(); return; }
          _lastBackAt = now;
          T(L2('আবার ব্যাক চাপলে অ্যাপ বন্ধ হবে', 'Press back again to exit'), 'info', { duration: 2000 });
        } catch (_) {}
      });
    } catch (_) {}
  }

  /* ─────────────── backup files (device Backup folder) ─────────────── */
  function saveBackup(json, fileName) {
    return saveFile(fileName, json, { dir: 'Backup' });
  }
  async function listBackups() {
    const FS = plug('Filesystem');
    if (!FS || !FS.readdir) return [];
    try {
      const r = await FS.readdir({ path: 'Puja Sarathi/Backup', directory: 'DOCUMENTS' });
      return (r.files || []).filter(f => !f.isDirectory).map(f => f.name).sort().reverse();
    } catch (_) { return []; }
  }
  async function readBackup(name) {
    const FS = plug('Filesystem');
    if (!FS || !FS.readFile) return null;
    try {
      const r = await FS.readFile({ path: 'Puja Sarathi/Backup/' + name, directory: 'DOCUMENTS', encoding: 'UTF8' });
      return r.data;
    } catch (_) { return null; }
  }
  async function pickBackupFile(btn) {
    try {
      const name = (btn && btn.getAttribute) ? btn.getAttribute('data-name') : '';
      if (!name) return;
      if (typeof closeModal === 'function') closeModal();
      const text = await readBackup(name);
      if (text == null) { T(L2('ফাইল পড়া যায়নি', 'Could not read the file'), 'err'); return; }
      const f = new File([text], name, { type: 'application/json' });
      let mode = 'replace';
      try {
        const c = document.querySelector('input[name="restoreMode"]:checked');
        if (c && c.value) mode = c.value;
      } catch (_) {}
      if (typeof restoreFromBackupFile === 'function') await restoreFromBackupFile(f, mode);
    } catch (e) {
      T(L2('রিস্টোর ব্যর্থ: ', 'Restore failed: ') + (e && e.message ? e.message : e), 'err');
    }
  }

  /* ─────────────── barcode / QR scanner ───────────────
     Uses the Google Play Services code scanner via the NativeBridge — no
     camera permission and no bundled ML Kit model (tiny APK). */
  async function scanInto(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const NB = plug('NativeBridge');
    if (!NB || !NB.scanBarcode) {
      T(L2('স্ক্যানার শুধু Android অ্যাপে কাজ করে (Google Play Services লাগবে)', 'Scanner works in the Android app only (needs Google Play Services)'), 'warn');
      return;
    }
    try {
      T(L2('স্ক্যানার খুলছি…', 'Opening scanner…'), 'info', { duration: 1500 });
      const res = await NB.scanBarcode({});
      if (res && res.cancelled) return;
      const raw = res && res.value ? res.value : '';
      /* QR এ লিংক থাকতে পারে (https…?join=PS-X বা pujasarathi://join?code=PS-X)
         — শুধু কোডটা বের করে বসাই; সরাসরি কোড টাইপ করা হলে সেটাই থাকে */
      const val = (extractJoin(raw)) || String(raw || '').trim().toUpperCase();
      if (val) {
        input.value = val;
        try {
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (_) {}
        T(L2('স্ক্যান হয়েছে ✓', 'Scanned ✓'), 'ok');
      }
    } catch (e) {
      const msg = (e && e.message) ? String(e.message) : '';
      if (/cancel/i.test(msg)) return;
      T(L2('স্ক্যান করা গেল না: ', 'Scan failed: ') + msg, 'err');
    }
  }

  /* ─────────────── invite deep links ───────────────
     publicUrl (capacitor.config.json → "publicUrl") is the https home of the
     hosted PWA. Set it and invites shared from the APK become working links;
     with an https intent-filter + assetlinks.json those links open the app
     directly from WhatsApp. Unconfigured → shares code-only text (safe). */
  let _publicUrl = '';
  /* ডোমেইন হার্ড-কোডেড ফলব্যাক — getConfig কোনো কারণে খালি দিলেও
     invite লিঙ্ক সবসময় হোস্টেড https আকারেই যাবে */
  const FALLBACK_PUBLIC_URL = 'https://adityasolutionsproducts.github.io/Puja-Sarathi/';
  function publicUrl() { return _publicUrl || (isNative() ? FALLBACK_PUBLIC_URL : ''); }
  async function loadConfig() {
    try {
      const c = cap();
      if (c && c.getConfig) {
        const cfg = await c.getConfig();
        const u = cfg ? String(cfg.publicUrl || '').trim() : '';
        if (/^https:\/\//i.test(u)) _publicUrl = u.replace(/\/?$/, '/');
      }
    } catch (_) {}
  }
  function inviteLink(code) {
    const c = String(code || '').trim();
    if (!c) return '';
    if (isNative()) {
      return _publicUrl ? _publicUrl + '?join=' + encodeURIComponent(c) : '';
    }
    try { return location.origin + location.pathname + '?join=' + encodeURIComponent(c); }
    catch (_) { return ''; }
  }
  function extractJoin(url) {
    try {
      const u = String(url || '');
      if (!u) return '';
      let m = u.match(/[?&](?:join|code|invite)=(PS-[A-Za-z0-9]{4,10})/i);
      if (!m) m = u.match(/pujasarathi:\/\/(?:join\/?)?(PS-[A-Za-z0-9]{4,10})/i);
      return m ? m[1].toUpperCase() : '';
    } catch (_) { return ''; }
  }
  function applyJoin(code) {
    if (!code) return;
    try { localStorage.setItem('ps_join_pending', code); } catch (_) {}
    try {
      const f = document.getElementById('inviteCodeField');
      if (f) f.value = code;
      const tab = document.getElementById('tabSignup');
      if (tab) tab.click();
      T(L2('Invite কোড পাওয়া গেছে: ', 'Invite code found: ') + code + ' — ' + L2('নাম ও পাসওয়ার্ড দিয়ে অ্যাকাউন্ট খুলুন', 'create account with name & password'), 'info', { duration: 6000 });
    } catch (_) {}
  }
  async function initDeepLinks() {
    const App = plug('App');
    if (!App) return;
    try {
      const lu = await App.getLaunchUrl();
      const c0 = extractJoin(lu && lu.url);
      if (c0) applyJoin(c0);
    } catch (_) {}
    try {
      App.addListener('appUrlOpen', (d) => {
        const c = extractJoin(d && d.url);
        if (c) applyJoin(c);
      });
    } catch (_) {}
  }

  /* ─────────────── boot ─────────────── */
  function init() {
    if (!isNative()) return;
    initBackButton();
    initNotifications();
    syncStatusBar();
    loadConfig();
    initDeepLinks();      /* ?join= লিঙ্ক/কোল্ড-স্টার্ট URL ধরার listener */
  }
  function onBoot() {
    if (!isNative()) return;
    initNotifications();
    syncStatusBar();
    loadConfig();         /* publicUrl → invite/QR লিঙ্ক */
    initDeepLinks();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.PSN = {
    isNative: isNative,
    publicUrl: publicUrl,
    inviteLink: inviteLink,
    showQr: showQr,
    extractJoin: extractJoin,
    applyJoin: applyJoin,
    saveFile: saveFile,
    saveSheetAsPdf: saveSheetAsPdf,
    blobToBase64: blobToBase64,
    syncStatusBar: syncStatusBar,
    notify: notify,
    saveBackup: saveBackup,
    listBackups: listBackups,
    readBackup: readBackup,
    pickBackupFile: pickBackupFile,
    scanInto: scanInto,
    onBoot: onBoot,
    snack: snack
  };
})();
