/* 植迹 · 植物名片海报
 * 经典脚本（无 import / export），构建时由 build.mjs 内联进页面，只挂一个入口：
 *   globalThis.openPlantCard(record)
 * 绘制完全在 1080×1440 的 canvas 上完成，只用系统字体，不加载任何外部资源。
 * 任何字段缺失、名称为空或超长、绘图环境不可用时都静默降级，绝不抛异常。
 */
(function () {
  'use strict';

  var CARD_W = 1080, CARD_H = 1440;
  var PAPER = '#f7f2e4', INK = '#233a31', MOSS = '#4f6b57';
  var DEEP = '#213e35', CREAM = '#f4f1e4', RULE = '#cabfa2', FAINT = '#d8d0b6';
  var SERIF = "'Songti SC',SimSun,serif";
  var SANS = "system-ui,'PingFang SC','Microsoft YaHei',sans-serif";

  function text(value) {
    return value === undefined || value === null ? '' : String(value);
  }

  // 名称最多保留 64 个字符再参与排版：既避免超长字段把 canvas 拖死，也不会让
  // measureText 在荒唐输入上反复测量。
  function trim(value, limit) {
    var raw = text(value).replace(/\s+/g, ' ').trim();
    var max = limit || 64;
    return raw.length > max ? raw.slice(0, max) : raw;
  }

  function measure(ctx, value) {
    try {
      var metrics = ctx.measureText(String(value));
      if (metrics && typeof metrics.width === 'number' && isFinite(metrics.width)) return metrics.width;
    } catch (error) { /* 测量失败时按字符数估算，继续画 */ }
    return String(value).length * 16;
  }

  // 先缩字号，再截断加省略号：长中文名永远不会溢出卡片。
  function fitText(ctx, value, maxWidth, options) {
    var opts = options || {};
    var family = opts.family || SERIF;
    var weight = opts.weight || 'normal';
    var size = opts.maxSize || 40, minSize = opts.minSize || 18;
    var raw = trim(value, opts.limit || 64) || opts.empty || '';
    var style = function (px) { return weight + ' ' + px + 'px ' + family; };
    ctx.font = style(size);
    while (size > minSize && measure(ctx, raw) > maxWidth) {
      size -= 2;
      ctx.font = style(size);
    }
    var fitted = raw;
    if (measure(ctx, fitted) > maxWidth) {
      var cut = fitted;
      while (cut.length > 1 && measure(ctx, cut + '…') > maxWidth) cut = cut.slice(0, -1);
      fitted = (cut || fitted.charAt(0)) + '…';
    }
    return { text: fitted, size: size, font: style(size) };
  }

  function drawSpaced(ctx, value, centerX, baseline, spacing, size, color) {
    var chars = Array.from(text(value));
    if (!chars.length) return;
    // 先定字体再量字宽：否则会拿上一段文字的字体测量，标题就会偏出中线。
    ctx.font = 'bold ' + size + 'px ' + SERIF;
    var widths = chars.map(function (char) { return measure(ctx, char); });
    var total = widths.reduce(function (sum, width) { return sum + width; }, 0) + spacing * Math.max(0, chars.length - 1);
    // 标题本身也兜底：就算字体缺字、测量异常，也不会画出卡片边界。
    while (total > CARD_W - 120 && spacing > 0) {
      spacing -= 1;
      total -= Math.max(0, chars.length - 1);
    }
    var x = centerX - total / 2;
    ctx.fillStyle = color || CREAM;
    ctx.textAlign = 'left';
    for (var i = 0; i < chars.length; i++) {
      ctx.fillText(chars[i], x, baseline);
      x += widths[i] + spacing;
    }
  }

  function line(ctx, x1, y1, x2, y2, color, width) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width || 1;
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function makeCanvas(width, height) {
    try {
      var canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      return canvas;
    } catch (error) { return null; }
  }

  function getContext(canvas) {
    if (!canvas || typeof canvas.getContext !== 'function') return null;
    try { return canvas.getContext('2d') || null; } catch (error) { return null; }
  }

  // 植株来自现有的 paintSpecimen：先画到离屏 canvas，再整块贴到名片上，
  // 这样 paintSpecimen 内部的 clearRect 不会擦掉卡片底纹。record.photo 只是
  // 缩略图 dataURL，体积不可控，因此从不直接上名片。
  function drawSpecimen(ctx, record, x, y, width, height) {
    var layer = makeCanvas(width, height), layerCtx = getContext(layer);
    var blank = true;
    if (layerCtx && typeof globalThis.paintSpecimen === 'function') {
      try {
        globalThis.paintSpecimen(layer, record, { potted: true, portrait: true, width: width, height: height });
        blank = !hasInk(layerCtx, width, height);
      } catch (error) { blank = true; }
    }
    if (blank) {
      if (layerCtx) paintFallbackSpecimen(layerCtx, width, height);
    }
    if (blank && !layerCtx) return;
    try { ctx.drawImage(layer, x, y, width, height); } catch (error) { /* 贴图失败就留白 */ }
  }

  // 粗采样判断离屏层是否真的有内容（paintSpecimen 遇到未知 form 时不报错、直接画空）。
  function hasInk(ctx, width, height) {
    try {
      var data = ctx.getImageData(0, 0, width, height).data;
      for (var i = 3; i < data.length; i += 4 * 97) if (data[i] > 8) return true;
      return false;
    } catch (error) {
      // 读取像素被浏览器拒绝（跨域/环境限制）时无从判断，按“有内容”处理。
      return true;
    }
  }

  // paintSpecimen 缺失（例如名片脚本单独加载）时的兜底插图：一支写意枝叶。
  function paintFallbackSpecimen(ctx, width, height) {
    var cx = width / 2, base = height * 0.86;
    ctx.save();
    ctx.strokeStyle = '#6c7f5e';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, base);
    ctx.bezierCurveTo(cx - 12, base - height * 0.26, cx + 14, base - height * 0.52, cx - 6, base - height * 0.78);
    ctx.stroke();
    ctx.fillStyle = '#8ea477';
    var leaves = [
      [-1, 0.62, 0.9], [1, 0.54, 0.92], [-1, 0.44, 0.78], [1, 0.36, 0.74], [-1, 0.27, 0.6], [1, 0.2, 0.56]
    ];
    leaves.forEach(function (leaf) {
      var side = leaf[0], at = leaf[1], scale = leaf[2];
      var lx = cx + side * 8, ly = base - height * at;
      ctx.beginPath();
      ctx.ellipse(lx + side * 54 * scale, ly - 10, 54 * scale, 22 * scale, side * 0.42, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  function drawCard(canvas, record) {
    canvas.width = CARD_W;
    canvas.height = CARD_H;
    var ctx = getContext(canvas);
    if (!ctx) return false;

    try {
      ctx.fillStyle = PAPER;
      ctx.fillRect(0, 0, CARD_W, CARD_H);

      // 纸纹：一组极淡的横向细线，纯色 + 细线，不依赖纹理图片。
      ctx.strokeStyle = 'rgba(118,106,74,0.05)';
      ctx.lineWidth = 1;
      for (var y = 196; y < CARD_H - 60; y += 38) line(ctx, 64, y, CARD_W - 64, y, 'rgba(118,106,74,0.05)', 1);

      // 顶部深绿书眉。
      ctx.fillStyle = DEEP;
      ctx.fillRect(0, 0, CARD_W, 176);
      line(ctx, 60, 168, CARD_W - 60, 168, 'rgba(244,241,228,0.32)', 1);
      ctx.font = '22px ' + SANS;
      ctx.fillStyle = 'rgba(244,241,228,0.62)';
      ctx.textAlign = 'center';
      ctx.fillText('CAMPUS HERBARIUM', CARD_W / 2, 62);
      drawSpaced(ctx, '植迹 · 校园植物手记', CARD_W / 2, 132, 10, 52, CREAM);

      // 植株插图：760×700，水平居中，落在书眉与正文之间。
      drawSpecimen(ctx, record, (CARD_W - 760) / 2, 236, 760, 700);

      // 图注分隔线，两端收窄，像标本纸上的定位线。
      line(ctx, 220, 992, CARD_W - 220, 992, RULE, 1);
      line(ctx, 220, 996, CARD_W - 220, 996, 'rgba(202,191,162,0.45)', 1);

      var name = fitText(ctx, record.name || record.plantName, 880, {
        family: SERIF, weight: 'bold', maxSize: 104, minSize: 46, limit: 40, empty: '未命名植物'
      });
      ctx.textAlign = 'center';
      ctx.fillStyle = INK;
      ctx.font = name.font;
      ctx.fillText(name.text, CARD_W / 2, 1112);

      var latin = fitText(ctx, record.latin || record.latinName, 880, {
        family: "'Times New Roman',Georgia,serif", weight: 'italic', maxSize: 44, minSize: 24, limit: 90
      });
      ctx.fillStyle = MOSS;
      ctx.font = latin.font;
      if (latin.text) ctx.fillText(latin.text, CARD_W / 2, 1170);

      var family = trim(record.family, 30);
      if (family) {
        ctx.font = '26px ' + SANS;
        ctx.fillStyle = 'rgba(79,107,87,0.85)';
        ctx.fillText(family, CARD_W / 2, 1216);
      }

      var spot = text(record.spotName) || text(record.location) || '校园';
      var date = text(record.date);
      var info = [date, spot].filter(function (part) { return !!part; }).join(' · ');
      var meta = fitText(ctx, info, 860, { family: SANS, maxSize: 34, minSize: 22, limit: 70, empty: '校园' });
      ctx.fillStyle = '#5d6b5a';
      ctx.font = meta.font;
      ctx.fillText(meta.text, CARD_W / 2, 1272);
      line(ctx, CARD_W / 2 - 42, 1300, CARD_W / 2 + 42, 1300, FAINT, 1);

      ctx.font = '27px ' + SANS;
      ctx.fillStyle = 'rgba(93,107,90,0.78)';
      ctx.fillText('Campus Herbarium · 中国农业大学', CARD_W / 2, 1352);

      // 四角定位细线，收束整张卡片的版面；落在深色书眉里的两道换成米色，避免看不清。
      var ticks = [[64, 64], [CARD_W - 64, 64], [64, CARD_H - 64], [CARD_W - 64, CARD_H - 64]];
      ticks.forEach(function (point) {
        var sx = point[0] < CARD_W / 2 ? 1 : -1, sy = point[1] < CARD_H / 2 ? 1 : -1;
        var color = point[1] < 176 ? 'rgba(244,241,228,0.5)' : 'rgba(202,191,162,0.9)';
        line(ctx, point[0], point[1], point[0] + sx * 26, point[1], color, 1);
        line(ctx, point[0], point[1], point[0], point[1] + sy * 26, color, 1);
      });
      return true;
    } catch (error) {
      // 绘图环境残缺（如极简 canvas 实现）时也要让预览可用。
      return false;
    }
  }

  function fileName(record) {
    var raw = trim(record.name || record.plantName || '植物', 24) || '植物';
    var safe = raw.replace(/[\\/:*?"<>|\s]+/g, '-').replace(/^-+|-+$/g, '');
    return '植迹-' + (safe || '植物') + '.png';
  }

  function notify(message) {
    try {
      if (typeof globalThis.toast === 'function') { globalThis.toast(message); return; }
      if (typeof document !== 'undefined' && document.getElementById) {
        var node = document.getElementById('toast');
        if (node) { node.textContent = message; return; }
      }
    } catch (error) { /* 提示失败不影响主流程 */ }
  }

  function saveCanvas(canvas, name) {
    var trigger = function (href, revoke) {
      try {
        var link = document.createElement('a');
        link.href = href;
        link.download = name;
        link.rel = 'noopener';
        link.style.display = 'none';
        (document.body || document.documentElement).appendChild(link);
        link.click();
        setTimeout(function () {
          try { link.remove(); } catch (error) { /* 老浏览器没有 remove */ }
          if (revoke && typeof URL !== 'undefined' && URL.revokeObjectURL) URL.revokeObjectURL(href);
        }, 4000);
      } catch (error) {
        notify('浏览器不支持直接保存，请长按图片另存。');
      }
    };
    if (typeof canvas.toBlob === 'function') {
      try {
        canvas.toBlob(function (blob) {
          if (!blob) { notify('图片生成失败，请重试。'); return; }
          var href = '';
          try { href = URL.createObjectURL(blob); } catch (error) { href = ''; }
          if (href) { trigger(href, true); return; }
          try { trigger(canvas.toDataURL('image/png'), false); } catch (error) { notify('图片生成失败，请重试。'); }
        }, 'image/png');
        return;
      } catch (error) { /* 继续走 dataURL 兜底 */ }
    }
    try { trigger(canvas.toDataURL('image/png'), false); } catch (error) { notify('图片生成失败，请重试。'); }
  }

  function mount(markup) {
    var showFn = typeof globalThis.show === 'function' ? globalThis.show : null;
    if (showFn) { showFn(markup); return true; }
    // 没有 show() 时退回直接操作已有对话框，保证名片仍可打开。
    try {
      if (typeof document === 'undefined') return false;
      var content = document.getElementById('content');
      var modal = document.getElementById('modal');
      if (content) content.innerHTML = markup;
      if (modal && typeof modal.showModal === 'function' && !modal.open) modal.showModal();
      return !!content;
    } catch (error) { return false; }
  }

  function markup() {
    return '<div class="body" id="plantCardBody">' +
      '<div class="eyebrow">PLANT CARD</div><h2>植物名片</h2>' +
      '<canvas id="plantCardCanvas" width="' + CARD_W + '" height="' + CARD_H + '" aria-label="植物名片预览" ' +
      'style="display:block;width:100%;max-width:420px;height:auto;margin:0 auto 16px;border-radius:14px;background:' + PAPER + ';box-shadow:0 14px 32px rgba(27,48,40,.22)"></canvas>' +
      '<div class="actions"><button class="primary" id="plantCardSave" type="button">保存 PNG</button>' +
      '<button class="light" id="plantCardClose" type="button">关闭</button></div>' +
      '<p role="status" id="plantCardHint" style="font-size:13px;line-height:1.6;opacity:.72;text-align:center;margin-top:10px">' +
      '保存后可分享到聊天与朋友圈。</p></div>';
  }

  function bind(canvas, name) {
    try {
      var save = document.getElementById('plantCardSave');
      if (save) save.addEventListener('click', function () { saveCanvas(canvas, name); });
      var close = document.getElementById('plantCardClose');
      if (close) close.addEventListener('click', function () {
        try {
          var modal = document.getElementById('modal');
          if (modal && typeof modal.close === 'function') modal.close();
        } catch (error) { /* 对话框已关闭或不可用 */ }
      });
    } catch (error) { /* 绑定失败不影响名片展示 */ }
  }

  function openPlantCard(record) {
    var source = record && typeof record === 'object' ? record : (record ? { name: String(record) } : {});
    try {
      if (typeof document === 'undefined') return false;
      if (!mount(markup())) return false;
      var canvas = null;
      try { canvas = document.getElementById('plantCardCanvas'); } catch (error) { canvas = null; }
      if (!canvas) canvas = makeCanvas(CARD_W, CARD_H);
      if (!canvas) return false;
      drawCard(canvas, source);
      bind(canvas, fileName(source));
      return true;
    } catch (error) {
      notify('名片生成失败，请稍后再试。');
      return false;
    }
  }

  globalThis.openPlantCard = openPlantCard;
})();
