/* OceanSafe creator kit — QR codes + printable assets for the creator program.
 *
 * ONE engine, two callers: creator-dash.html ("Your assets" card) and
 * creator-print.html (the print sheet). Both import this file. If you change a
 * layout, both surfaces move together — the operator side learned this the hard
 * way when townad-demo.html and d.html drifted apart.
 *
 * Requires /assets/vendor/qrcode.min.js to be loaded first.
 *
 * WHAT THE QR ENCODES: the creator's canonical link, unchanged, on every asset.
 * Deliberately NOT a per-placement ?qr= param like the operator dashboard uses —
 * that only means something because seed_partner_qr() creates a bucket per
 * placement and the dashboard reports scans against it. There is no such seeding
 * for creators, so a ?qr= here would produce a tracking promise we can't keep.
 * One link, honestly counted, until the buckets exist.
 */
(function (global) {
  "use strict";

  var MARK = "/assets/oceansafe-favicon.png";
  var MARK_FRAC = 0.16;          // centre mark as a fraction of the code — matches d.html
  var MASTER = 1400;             // render big, downsample into assets; never upscale

  var SAND = "#FBF8F2", DEEP = "#0F3D49", TEAL = "#0A8BA8",
      INK = "#16202A", MUTE = "#5B6B76", GOLD = "#F0B429";

  var F = function (w, s) {
    return w + " " + Math.round(s) + "px Inter,-apple-system,Segoe UI,system-ui,sans-serif";
  };

  // ── the set ────────────────────────────────────────────────────────────────
  // "bare" leads: it's the one most creators actually reach for — dropping the
  // code into their own artwork, a sponsor deck, or a printer's template.
  // Print sizes are inches at 300dpi; the two screen sizes are the native
  // Instagram/TikTok canvases, which is where a creator's audience actually is.
  var ASSETS = [
    { key: "bare",    label: "Just the QR code",  w: 1200, h: 1200, sz: "any size · for your own artwork", layout: "bare",   print: true  },
    { key: "card",    label: "Hand-out card",     w: 1200, h: 1800, sz: "4 × 6 in",                        layout: "tall",   print: true  },
    { key: "sticker", label: "Sticker",           w: 900,  h: 900,  sz: "3 × 3 in",                        layout: "square", print: true  },
    { key: "flyer",   label: "Flyer / poster",    w: 1650, h: 2550, sz: "5.5 × 8.5 in",                    layout: "tall",   print: true  },
    { key: "story",   label: "Story graphic",     w: 1080, h: 1920, sz: "1080 × 1920 · for Stories",       layout: "story",  print: false },
    { key: "feed",    label: "Feed square",       w: 1080, h: 1080, sz: "1080 × 1080 · for a post or bio", layout: "feed",   print: false }
  ];

  // Download sizes offered for the code on its own. 600px is the floor that
  // still prints a 2-inch code at 300dpi; below that it's a screen asset only.
  var PNG_SIZES = [
    { key: "sm", px: 600,  label: "Small",  note: "2 in at 300dpi · email, receipts" },
    { key: "md", px: 1200, label: "Medium", note: "4 in at 300dpi · cards, flyers" },
    { key: "lg", px: 2400, label: "Large",  note: "8 in at 300dpi · posters, signage" }
  ];

  // ── the mark, loaded once ──────────────────────────────────────────────────
  // Never allowed to block or reject: if the icon 404s we fall back to a drawn
  // wave and the creator still gets every asset. A missing logo must not cost
  // someone their print kit.
  var _mark = null;
  function markImage() {
    if (_mark) return _mark;
    _mark = new Promise(function (resolve) {
      var m = new Image();
      m.onload = function () { resolve(m); };
      m.onerror = function () { resolve(null); };
      m.src = MARK;
    });
    return _mark;
  }

  // The SVG needs the mark inline as a data URI — an external href would break
  // the moment the file is opened off a desktop or handed to a print shop.
  var _markData = null;
  function markDataUri() {
    if (_markData) return _markData;
    _markData = fetch(MARK)
      .then(function (r) { if (!r.ok) throw new Error("mark " + r.status); return r.blob(); })
      .then(function (b) {
        return new Promise(function (resolve) {
          var fr = new FileReader();
          fr.onload = function () { resolve(fr.result); };
          fr.onerror = function () { resolve(null); };
          fr.readAsDataURL(b);
        });
      })
      .catch(function () { return null; });
    return _markData;
  }

  // ── QR as PNG ──────────────────────────────────────────────────────────────
  function qrPng(url, size) {
    return new Promise(function (resolve, reject) {
      if (!global.QRCode) return reject(new Error("qrcode lib not loaded"));
      // Error correction H — the centre mark covers ~16% of the code, and H
      // tolerates 30% loss. Anything lower and the mark eats the data.
      global.QRCode.toDataURL(url, { margin: 1, width: size, errorCorrectionLevel: "H" }, function (e, qr) {
        if (e) return reject(e);
        var base = new Image();
        base.onload = function () {
          var c = document.createElement("canvas");
          c.width = c.height = size;
          var x = c.getContext("2d");
          x.drawImage(base, 0, 0, size, size);
          markImage().then(function (mark) {
            if (mark) {
              var s = Math.round(size * MARK_FRAC),
                  o = Math.round((size - s) / 2),
                  pad = Math.round(s * 0.14),
                  br = Math.round(s * 0.26);
              x.fillStyle = "#fff";       // quiet backing so the mark reads off the modules
              x.beginPath();
              if (x.roundRect) x.roundRect(o - pad, o - pad, s + pad * 2, s + pad * 2, br);
              else x.rect(o - pad, o - pad, s + pad * 2, s + pad * 2);
              x.fill();
              x.drawImage(mark, o, o, s, s);
            }
            resolve(c.toDataURL("image/png"));
          });
        };
        base.onerror = function () { reject(new Error("qr render failed")); };
        base.src = qr;
      });
    });
  }

  // ── QR as SVG ──────────────────────────────────────────────────────────────
  // Vector, so a print shop can blow it up to a banner with no soft edges. The
  // library emits a plain black code; we inject the same white-backed centre
  // mark the PNG carries so the two formats are the same artwork.
  function qrSvg(url) {
    return new Promise(function (resolve, reject) {
      if (!global.QRCode) return reject(new Error("qrcode lib not loaded"));
      global.QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "H" }, function (e, svg) {
        if (e) return reject(e);
        markDataUri().then(function (uri) {
          if (!uri) return resolve(svg);
          // The lib sets viewBox="0 0 N N" in QR module units — read N so the
          // mark is placed in the code's own coordinate space at any scale.
          var m = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
          if (!m) return resolve(svg);
          var n = parseFloat(m[1]),
              s = n * MARK_FRAC,
              o = (n - s) / 2,
              pad = s * 0.14,
              br = s * 0.26;
          var overlay =
            '<rect x="' + (o - pad) + '" y="' + (o - pad) + '" width="' + (s + pad * 2) +
            '" height="' + (s + pad * 2) + '" rx="' + br + '" ry="' + br + '" fill="#fff"/>' +
            '<image x="' + o + '" y="' + o + '" width="' + s + '" height="' + s +
            '" href="' + uri + '" preserveAspectRatio="xMidYMid meet"/>';
          resolve(svg.replace(/<\/svg>\s*$/, overlay + "</svg>"));
        });
      });
    });
  }

  function svgBlobUrl(svg) {
    return URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  }

  // ── asset canvas ───────────────────────────────────────────────────────────
  function wave(x, cx, cy, w, col) {
    x.strokeStyle = col; x.lineWidth = w * 0.075; x.lineCap = "round";
    x.beginPath();
    for (var i = 0; i <= w; i += 1) {
      var yy = cy + Math.sin((i / w) * Math.PI * 3) * (w * 0.055);
      i ? x.lineTo(cx + i - w / 2, yy) : x.moveTo(cx + i - w / 2, yy);
    }
    x.stroke();
  }

  function lockup(x, W, cy, iconSize, fontPx, mark) {
    if (!mark) { wave(x, W / 2, cy + iconSize * 0.34, W * 0.20, GOLD); return; }
    x.font = F(800, fontPx);
    var t = "OceanSafe", tw = x.measureText(t).width, gap = iconSize * 0.30;
    var sx = (W - (iconSize + gap + tw)) / 2;
    var ta = x.textAlign, tb = x.textBaseline;
    x.drawImage(mark, sx, cy - iconSize / 2, iconSize, iconSize);
    x.textAlign = "left"; x.textBaseline = "middle"; x.fillStyle = "#fff";
    x.fillText(t, sx + iconSize + gap, cy);
    x.textAlign = ta; x.textBaseline = tb;
  }

  function drawAsset(spec, qrImg, mark, handle) {
    var c = document.createElement("canvas");
    c.width = spec.w; c.height = spec.h;
    var x = c.getContext("2d"), W = spec.w, H = spec.h;

    // Draw the QR with smoothing OFF, always. Canvas interpolation softens
    // module edges; combined with the centre mark that was enough to make a
    // long-slug code fail OpenCV at EVERY scale on the operator side. A QR is
    // black-and-white geometry — nearest-neighbour is both correct and sharper.
    var qr = function (img, dx, dy, dw, dh) {
      var s = x.imageSmoothingEnabled;
      x.imageSmoothingEnabled = false;
      x.drawImage(img, dx, dy, dw, dh);
      x.imageSmoothingEnabled = s;
    };
    var at = "@" + String(handle || "").slice(0, 24);

    x.fillStyle = SAND; x.fillRect(0, 0, W, H); x.textBaseline = "top";

    // Bare: nothing but the code, on WHITE not sand. Thermal printers and
    // one-colour sign vinyl threshold to pure black/white, and a tinted quiet
    // zone can dither into speckle that costs the scan. Quiet zone ~8% a side.
    if (spec.layout === "bare") {
      x.fillStyle = "#fff"; x.fillRect(0, 0, W, H);
      var pad = Math.round(W * 0.08);
      qr(qrImg, pad, pad, W - pad * 2, W - pad * 2);
      return c;
    }

    if (spec.layout === "square") {                     // sticker
      x.fillStyle = DEEP; x.fillRect(0, 0, W, H * 0.26);
      x.textAlign = "center";
      lockup(x, W, H * 0.13, W * 0.115, W * 0.075, mark);
      var q = W * 0.52;
      x.fillStyle = "#fff";
      x.fillRect(W / 2 - q / 2 - W * 0.02, H * 0.33, q + W * 0.04, q + W * 0.04);
      qr(qrImg, W / 2 - q / 2, H * 0.34, q, q);
      x.fillStyle = INK; x.font = F(700, W * 0.062);
      x.fillText("Free beach guide", W / 2, H * 0.885);
      x.fillStyle = TEAL; x.font = F(600, W * 0.042);
      x.fillText(at, W / 2, H * 0.945);
      x.textAlign = "left"; return c;
    }

    // story + feed — screen assets. Deep field, big code, room at the top for
    // the creator to drop a sticker or their own caption over it.
    //
    // Laid out from a running cursor with font-relative line heights, NOT fixed
    // fractions of H. The square feed canvas has roughly half the vertical
    // budget of a story at the same width, so one shared set of H-fractions
    // can't serve both: the first version collided the two headline lines and
    // pushed the handle off the bottom edge of the 1080 × 1080.
    if (spec.layout === "story" || spec.layout === "feed") {
      var story = spec.layout === "story";
      var g = x.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, DEEP); g.addColorStop(1, "#093039");
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      x.textAlign = "center";

      // Shrink a line until it fits the canvas — a long word or a wider font
      // must never run off the edge.
      var maxW = W * 0.88;
      var fit = function (t, weight, px) {
        var s = px;
        while (s > 10) { x.font = F(weight, s); if (x.measureText(t).width <= maxW) break; s -= 1; }
        return s;
      };

      var y = story ? H * 0.155 : W * 0.105;          // lockup centre
      lockup(x, W, y, W * 0.095, W * 0.062, mark);
      y += W * (story ? 0.075 : 0.080);               // cursor → top of headline

      var hf = W * (story ? 0.082 : 0.068), hl;
      x.fillStyle = "#fff";
      if (story) {
        hl = hf * 1.16;
        hf = fit("beach guide", 800, hf); hl = hf * 1.16;
        x.font = F(800, hf);
        x.fillText("Free Hawaiʻi", W / 2, y); y += hl;
        x.fillText("beach guide", W / 2, y); y += hl;
      } else {
        // One line on the square — two would eat the code's room.
        hf = fit("Free Hawaiʻi beach guide", 800, hf); hl = hf * 1.16;
        x.font = F(800, hf);
        x.fillText("Free Hawaiʻi beach guide", W / 2, y); y += hl;
      }

      // The square gets ONE subtitle line. Two costs ~60px of height, and on a
      // 1080 × 1080 that height comes straight out of the code — which is what
      // dropped a long-handle feed square below a usable scan floor.
      var subs = story ? ["Today’s surf, wind, and which", "beaches are calm right now."]
                       : ["Today’s surf, wind, and which beaches are calm."];
      var sf = W * 0.038;
      x.fillStyle = "#BBD3DA";
      subs.forEach(function (t) { sf = Math.min(sf, fit(t, 400, sf)); });
      var sl = sf * 1.38;
      x.font = F(400, sf);
      y += sf * 0.30;
      subs.forEach(function (t) { x.fillText(t, W / 2, y); y += sl; });
      y += sf * 0.7;

      // Size the code from what's actually left, so it can't push the footer
      // off the canvas: reserve the two footer lines plus the bottom margin.
      var scanF = W * 0.042, handF = W * 0.052;
      var footer = scanF * 1.5 + handF * 1.6 + W * 0.035;
      var sq = Math.min(W * (story ? 0.52 : 0.46), H - y - footer - W * 0.052);
      var sx = W / 2 - sq / 2;
      x.fillStyle = "#fff";
      x.fillRect(sx - W * 0.026, y - W * 0.026, sq + W * 0.052, sq + W * 0.052);
      qr(qrImg, sx, y, sq, sq);
      y += sq + W * 0.052;

      x.fillStyle = GOLD; x.font = F(700, fit("Scan with your camera", 700, scanF));
      x.fillText("Scan with your camera", W / 2, y); y += scanF * 1.5;
      // Fit the handle too — a 24-character @name at a fixed size runs off both
      // edges of the canvas.
      x.fillStyle = "#fff"; x.font = F(800, fit(at, 800, handF));
      x.fillText(at, W / 2, y);
      x.textAlign = "left"; return c;
    }

    // tall — hand-out card + flyer
    var band = H * 0.145;
    x.fillStyle = DEEP; x.fillRect(0, 0, W, band);
    x.textAlign = "center";
    lockup(x, W, band * 0.5, W * 0.085, W * 0.062, mark);
    x.fillStyle = INK; x.font = F(800, W * 0.075);
    x.fillText("Free Hawaiʻi", W / 2, band + H * 0.045);
    x.fillText("beach guide", W / 2, band + H * 0.088);
    x.fillStyle = MUTE; x.font = F(400, W * 0.038);
    x.fillText("Today’s surf, wind, and which", W / 2, band + H * 0.142);
    x.fillText("beaches are calm right now.", W / 2, band + H * 0.172);
    var tq = W * 0.56, ty = band + H * 0.225;
    x.fillStyle = "#fff";
    x.shadowColor = "rgba(15,61,73,.18)"; x.shadowBlur = W * 0.03; x.shadowOffsetY = W * 0.012;
    x.fillRect(W / 2 - tq / 2 - W * 0.028, ty - W * 0.028, tq + W * 0.056, tq + W * 0.056);
    x.shadowColor = "transparent";
    qr(qrImg, W / 2 - tq / 2, ty, tq, tq);
    x.fillStyle = TEAL; x.font = F(700, W * 0.040);
    x.fillText("Scan with your phone camera", W / 2, ty + tq + W * 0.055);
    var fy = ty + tq + W * 0.115;
    x.fillStyle = TEAL; x.font = F(800, W * 0.052);
    x.fillText(at, W / 2, fy);
    x.fillStyle = MUTE; x.font = F(400, W * 0.032);
    x.fillText("oceansafety.app", W / 2, fy + W * 0.068);
    x.textAlign = "left"; return c;
  }

  // ── public: render every asset for one creator ─────────────────────────────
  // Resolves [{spec, png}] in ASSETS order, skipping any single asset that
  // throws rather than losing the whole set to one bad layout.
  function renderAssets(link, handle) {
    return Promise.all([
      qrPng(link, MASTER).then(function (src) {
        return new Promise(function (res, rej) {
          var im = new Image();
          im.onload = function () { res(im); };
          im.onerror = rej;
          im.src = src;
        });
      }),
      markImage()
    ]).then(function (r) {
      var qrImg = r[0], mark = r[1], out = [];
      ASSETS.forEach(function (spec) {
        try {
          out.push({ spec: spec, png: drawAsset(spec, qrImg, mark, handle).toDataURL("image/png") });
        } catch (_) { /* one bad asset must not cost the creator the other five */ }
      });
      return out;
    });
  }

  global.OSCreatorKit = {
    ASSETS: ASSETS,
    PNG_SIZES: PNG_SIZES,
    qrPng: qrPng,
    qrSvg: qrSvg,
    svgBlobUrl: svgBlobUrl,
    renderAssets: renderAssets
  };
})(window);
