import * as THREE from 'three';

// DOM overlay: loading, menu, HUD, pause, settings, results.
const RAGE_NAMES = ['Suspicious', 'Hunting', 'Enraged', 'FURIOUS', 'MELTDOWN'];
const GRANNY_MOODS = ['muttering about cat hair', 'sharpening her temper', 'throwing the good china', 'reaching for the axe', 'COMPLETELY UNHINGED'];

export class UI {
  constructor(root, game) {
    this.root = root;
    this.game = game;
    this.popups = [];
    this.settings = this.loadSettings();
    root.innerHTML = `
      <div id="vignette"></div>
      <div id="letterbox"></div>
      <div id="endCard" class="hidden"><div class="t">THE END</div><div class="s">(of the house)</div></div>
      <div id="flash"></div>
      <div id="hud" class="hidden">
        <div class="tl">
          <div class="scoreLbl">BAD OMEN SCORE</div>
          <div class="score" id="hScore">0</div>
          <div class="combo hidden" id="hCombo">x1</div>
          <div class="comboBar hidden" id="hComboBarW"><div id="hComboBar"></div></div>
          <div class="doom"><div class="meterLbl"><span>HOUSE DOOM</span><span id="hDoomPct">0%</span></div><div class="meter"><div id="hDoom"></div></div></div>
          <div class="toast hidden" id="hToast"></div>
        </div>
        <div class="tr rage" id="hRageBox">
          <div class="meterLbl"><span>GRANDMA'S RAGE</span><span id="hRagePct">0</span></div>
          <div class="meter"><div id="hRage"></div></div>
          <div class="phase" id="hRagePhase">Suspicious</div>
          <div class="granny" id="hGrannyMood">muttering about cat hair</div>
          <div class="keys" id="hKeys">
            <span><b>WASD</b> Move</span><span><b>Shift</b> Gallop</span>
            <span><b>Space</b> Jump</span><span><b>L-Click</b> Swipe</span>
            <span><b>R-Click</b> Pounce</span><span><b>F</b> Meow</span>
            <span><b>E</b> Hide / Claw</span><span><b>C</b> Crouch</span>
            <span><b>Esc</b> Pause</span><span><b>M</b> Mute</span>
          </div>
        </div>
        <div class="objective" id="hObj"><span class="tag">OBJECTIVE</span><span id="hObjText"></span></div>
        <div class="prompt hidden" id="hPrompt"></div>
        <div class="subs" id="hSubs"></div>
        <div class="banner hidden" id="hBanner"><div class="big"></div><div class="small"></div></div>
        <div class="achCard hidden" id="hAch"><div class="lbl">★ ACHIEVEMENT</div><div class="name"></div><div class="desc"></div></div>
        <div class="lockhint hidden" id="hLock">Click to control the camera</div>
        <div class="hint hidden" id="hTabSkip"><b>Tab</b>: skip tutorial</div>
        <div class="fps hidden" id="hFps"></div>
      </div>
      <div id="loading" class="screen"><div class="title">BAD OMEN</div><div class="bar"><div id="lBar"></div></div><div class="msg" id="lMsg">Summoning…</div></div>
      <div id="menu" class="screen hidden">
        <div class="eyes">● ●</div>
        <h1 class="logo">BAD OMEN</h1>
        <div class="sub">You are Komur, a black cat. Grandma hates black cats. Make her wreck her own house.</div>
        <div class="menuBtns">
          <button class="bo" data-act="play">Play</button>
          <button class="bo" data-act="controls">Controls</button>
          <button class="bo" data-act="settings">Settings</button>
          <button class="bo" data-act="achievements">Achievements</button>
          <button class="bo" data-act="credits">Credits</button>
        </div>
        <div class="foot" id="menuFoot">Game Jam Europe 2026</div>
      </div>
      <div id="achievements" class="screen hidden"><div class="panel"><h2>Achievements <span class="achCount" id="achCount"></span></h2>
        <div class="achList" id="achList"></div>
      <div style="text-align:center;margin-top:14px"><button class="bo small" data-act="back">Back</button></div></div></div>
      <div id="rotate"><div class="phone"><div class="eyes2">● ●</div></div><div class="t">Turn me sideways</div>
        <div class="s">BAD OMEN is played in landscape. Rotate your phone — the game waits right where you left it.</div></div>
      <div id="controls" class="screen hidden"><div class="panel"><h2>Controls</h2>
      <div class="controls touchOnly">
        <span class="k">Left thumb</span><span>Drag anywhere on the left to walk · push to the rim to gallop</span>
        <span class="k">Right thumb</span><span>Drag on the right to look around</span>
        <span class="k">SWIPE</span><span>Paw swipe — knock things off things</span>
        <span class="k">JUMP</span><span>Leap onto the ledge ahead (amber ring) · otherwise hop</span>
        <span class="k">POUNCE</span><span>Big leap, big impact</span>
        <span class="k">MEOW</span><span>Taunt Grandma (baits her throws!)</span>
        <span class="k">HIDE / CLAW</span><span>Hide · hold to scratch ropes &amp; weak spots</span>
        <span class="k">GALLOP · CROUCH</span><span>Toggles, left side</span>
        <span class="k">❚❚</span><span>Pause</span>
      </div><div class="controls deskOnly">
        <span class="k">W A S D</span><span>Walk (camera-relative)</span>
        <span class="k">Mouse</span><span>Look around</span>
        <span class="k">Shift</span><span>Gallop (turn hard at speed to drift)</span>
        <span class="k">Space</span><span>Leap onto the ledge ahead (amber ring) · otherwise hop</span>
        <span class="k">Left Click</span><span>Paw swipe — knock things off things</span>
        <span class="k">Right Click</span><span>Pounce — big leap, big impact</span>
        <span class="k">F</span><span>Meow / taunt Grandma (baits her throws!)</span>
        <span class="k">E</span><span>Hide · hold to scratch ropes &amp; weak spots</span>
        <span class="k">C</span><span>Crouch / sneak</span>
        <span class="k">Esc / M</span><span>Pause / mute</span>
      </div><p style="text-align:center;font-style:italic;margin:16px 0 4px">Grandma's thrown weapons break what your paws can't.<br>Stand by a <span style="color:#ffb020">glowing weak spot</span>, taunt, then <b>dodge</b>.</p>
      <div style="text-align:center"><button class="bo small" data-act="back">Back</button></div></div></div>
      <div id="settings" class="screen hidden"><div class="panel"><h2>Settings</h2><div class="settings">
        <label>Master volume</label><input type="range" min="0" max="1" step="0.05" data-set="master">
        <label>Music</label><input type="range" min="0" max="1" step="0.05" data-set="music">
        <label>Sound effects</label><input type="range" min="0" max="1" step="0.05" data-set="sfx">
        <label>Voices</label><input type="range" min="0" max="1" step="0.05" data-set="voice">
        <label>Mouse sensitivity</label><input type="range" min="0.3" max="2.5" step="0.05" data-set="sensitivity">
        <label>Invert mouse Y</label><input type="checkbox" data-set="invertY">
        <label>Subtitles</label><input type="checkbox" data-set="subtitles">
        <label>Reduce screen shake</label><input type="checkbox" data-set="comfort">
        <label>High quality effects (bloom, AA)</label><input type="checkbox" data-set="hq">
        <label>Show FPS</label><input type="checkbox" data-set="fps">
      </div><div style="text-align:center;margin-top:18px"><button class="bo small" data-act="back">Back</button></div></div></div>
      <div id="credits" class="screen hidden"><div class="panel"><h2>Credits</h2><div class="credits" id="creditsBody"></div>
      <div style="text-align:center;margin-top:14px"><button class="bo small" data-act="back">Back</button></div></div></div>
      <div id="pause" class="screen hidden">
        <h1 class="logo" style="font-size:90px">PAUSED</h1>
        <button class="bo" data-act="resume">Resume</button>
        <button class="bo" data-act="restart">Restart run</button>
        <button class="bo" data-act="controls">Controls</button>
        <button class="bo" data-act="settings">Settings</button>
        <button class="bo" data-act="quit">Main menu</button>
      </div>
      <div id="results" class="screen hidden">
        <div class="rankLbl" id="rLbl">YOUR CHAOS RANK</div>
        <h1 class="rank" id="rRank">BAD OMEN</h1>
        <div class="final" id="rScore">0</div>
        <div class="pb hidden" id="rPB">NEW PERSONAL BEST!</div>
        <div class="stats" id="rStats"></div>
        <div class="achRun" id="rAch"></div>
        <div class="quote" id="rQuote"></div>
        <div><button class="bo" data-act="restart">Play again</button><button class="bo" data-act="quit">Main menu</button></div>
      </div>
      <div id="skip" class="hidden" data-act="skip"><span class="deskOnly">Space / Esc: skip</span><span class="touchOnly">Skip ›</span></div>`;
    this.$ = (id) => root.querySelector('#' + id);
    this.el = {
      hud: this.$('hud'), score: this.$('hScore'), combo: this.$('hCombo'), comboBar: this.$('hComboBar'), comboBarW: this.$('hComboBarW'),
      doom: this.$('hDoom'), doomPct: this.$('hDoomPct'), rage: this.$('hRage'), ragePct: this.$('hRagePct'), ragePhase: this.$('hRagePhase'),
      rageBox: this.$('hRageBox'), mood: this.$('hGrannyMood'), obj: this.$('hObj'), objText: this.$('hObjText'), prompt: this.$('hPrompt'),
      subs: this.$('hSubs'), banner: this.$('hBanner'), lock: this.$('hLock'), fps: this.$('hFps'), flash: this.$('flash'), letterbox: this.$('letterbox'), skip: this.$('skip'),
    };
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      this.game.audio?.ui('click');
      this.onAction?.(b.dataset.act);
    });
    root.addEventListener('mouseover', (e) => { if (e.target.closest('button.bo')) this.game.audio?.ui('hover'); });
    this.syncSettings();
    for (const inp of root.querySelectorAll('[data-set]')) {
      const k = inp.dataset.set;
      inp.addEventListener('input', () => {
        this.settings[k] = inp.type === 'checkbox' ? inp.checked : parseFloat(inp.value);
        this.saveSettings();
        this.onSettings?.(this.settings);
      });
    }
    this.screens = ['loading', 'menu', 'controls', 'settings', 'credits', 'achievements', 'pause', 'results'];
    this.achQueue = [];
    this.subQueue = [];
    this.lastScore = 0;
    this.shownScore = 0;
  }

  loadSettings() {
    const def = { master: 0.85, music: 0.55, sfx: 0.85, voice: 1, sensitivity: 1, invertY: false, subtitles: true, comfort: false, fps: false, hq: true };
    try { return { ...def, ...(JSON.parse(localStorage.getItem('badomen.settings') || '{}')) }; } catch (_) { return def; }
  }
  saveSettings() { try { localStorage.setItem('badomen.settings', JSON.stringify(this.settings)); } catch (_) { /* private mode */ } }

  /** Push the current settings values into the Settings screen controls. */
  syncSettings() {
    for (const inp of this.root.querySelectorAll('[data-set]')) {
      const k = inp.dataset.set;
      if (inp.type === 'checkbox') inp.checked = !!this.settings[k]; else inp.value = this.settings[k];
    }
  }

  /** Small unobtrusive notice (quality changes etc.). */
  toast(text, dur = 4.5) {
    const t = this.$('hToast');
    t.textContent = text;
    t.classList.remove('hidden', 'fade-out');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => { t.classList.add('fade-out'); setTimeout(() => t.classList.add('hidden'), 500); }, dur * 1000);
  }

  show(name) {
    for (const s of this.screens) this.$(s).classList.toggle('hidden', s !== name);
    this.current = name;
  }
  hideScreens() { for (const s of this.screens) this.$(s).classList.add('hidden'); this.current = null; }
  setHud(on) { this.el.hud.classList.toggle('hidden', !on); }

  /** "Tab: skip tutorial" in the corner while the tutorial runs. */
  tutorialHint(on) {
    if (this._tutHint === on) return;
    this._tutHint = on;
    this.$('hTabSkip').classList.toggle('hidden', !on);
  }

  loading(p, msg) {
    this.$('lBar').style.width = `${Math.round(p * 100)}%`;
    if (msg) this.$('lMsg').textContent = msg;
  }

  setCredits(html) { this.$('creditsBody').innerHTML = html; }

  objective(text) {
    if (this._obj === text) return;
    this._obj = text;
    this.el.objText.textContent = text || '';
    this.el.obj.classList.toggle('hidden', !text);
    // a new objective pops in; the per-second "Disasters/Doom" refreshes of the same objective don't
    const head = text ? text.split('·')[0] : '';
    if (text && head !== this._objHead) this._popAnim(this.el.obj, false, 0.8);
    this._objHead = head;
  }

  prompt(html) {
    if (this._prompt === html) return;
    this._prompt = html;
    this.el.prompt.innerHTML = html || '';
    this.el.prompt.classList.toggle('hidden', !html);
  }

  subtitle(speaker, text, dur = 3.2, think = false) {
    if (!this.settings.subtitles) return;
    const line = document.createElement('div');
    const cls = speaker === 'Grandma' ? 'g' : 'k';
    line.innerHTML = `<span class="line"><span class="${cls}">${speaker}:</span> <span class="${think ? 'think' : ''}">${text}</span></span>`;
    this.el.subs.appendChild(line);
    while (this.el.subs.children.length > 2) this.el.subs.firstChild.remove();
    this._layoutPrompt();
    setTimeout(() => { line.classList.add('fade-out'); setTimeout(() => { line.remove(); this._layoutPrompt(); }, 500); }, dur * 1000);
  }

  clearSubtitles() { this.el.subs.replaceChildren(); this._layoutPrompt(); }

  /** Keep the interaction prompt above the subtitles: a long line wraps and a reply stacks, and the block grows up
   *  over the prompt's usual spot (bottom 118 px).  Runs only when the subtitles change, not per frame. */
  _layoutPrompt() {
    const h = this.el.subs.children.length ? this.el.subs.offsetHeight : 0;
    this.el.prompt.style.bottom = h ? `${Math.max(118, 44 + h + 10)}px` : '';
  }

  banner(big, small = '', { granny = false, dur = 1.8, priority = 1 } = {}) {
    // a disaster's own banner (priority 2) is never stepped on by a rage/combo banner while it's up
    const now = performance.now() / 1000;
    if (priority < (this._bannerPri ?? 0) && now < (this._bannerUntil ?? 0)) return;
    this._bannerPri = priority;
    this._bannerUntil = now + dur;
    const b = this.el.banner;
    b.querySelector('.big').textContent = big;
    b.querySelector('.small').textContent = small;
    b.classList.toggle('granny', granny);
    b.classList.remove('hidden', 'fade-out');
    // restart the pop with the Web Animations API: the old remove/offsetWidth/add trick forced a synchronous
    // layout (~8 ms each, three of them in one frame during a big chain reaction)
    this._popAnim(b);
    clearTimeout(this._bannerT);
    clearTimeout(this._bannerHideT);
    this._bannerT = setTimeout(() => { b.classList.add('fade-out'); this._bannerHideT = setTimeout(() => b.classList.add('hidden'), 500); }, dur * 1000);
  }

  _popAnim(el, centered = true, from = 0.3) {
    const t = centered ? 'translate(-50%, -50%) ' : 'translateX(-50%) ';
    try {
      el._pop?.cancel();
      el._pop = el.animate([{ transform: `${t}scale(${from})`, opacity: 0 }, { transform: `${t}scale(1)`, opacity: 1 }],
        { duration: 350, easing: 'cubic-bezier(.2, 1.6, .5, 1)' });
    } catch (_) { /* no WAAPI: the banner just appears */ }
  }

  popup(worldPos, text, cls = '') {
    if (this.game.state === 'cinematic' && cls !== 'big') return;
    // aggregate bursts: max one popup per 0.12s, extra points roll into a running total
    const now = performance.now();
    if (now - (this._lastPop ?? 0) < 120 && this.popups.length) {
      const last = this.popups[this.popups.length - 1];
      last.extra = (last.extra ?? 1) + 1;
      last.d.textContent = last.d.textContent.replace(/ \(\+\d+ more\)$/, '') + ` (+${last.extra - 1} more)`;
      return;
    }
    this._lastPop = now;
    const d = document.createElement('div');
    d.className = 'popup ' + cls;
    d.textContent = text;
    this.el.hud.appendChild(d);
    this.popups.push({ d, pos: worldPos.clone(), t: 0 });
    if (this.popups.length > 8) { const o = this.popups.shift(); o.d.remove(); }
  }

  flash(color = '#fff', strength = 0.6) {
    const f = this.el.flash;
    f.style.transition = 'none'; f.style.background = color; f.style.opacity = strength;
    requestAnimationFrame(() => { f.style.transition = 'opacity 0.6s'; f.style.opacity = 0; });
  }

  /** An achievement card slides in on the left (one at a time, queued), with a chime. */
  achievement(a) {
    this.achQueue.push(a);
    if (!this._achBusy) this._nextAch();
  }

  _nextAch() {
    const st = this.game.state;
    // cards wait out cutscenes (six of them covered the whole ending); the results screen lists the run's anyway
    if (st === 'results' || st === 'menu') { this.achQueue.length = 0; this._achBusy = false; return; }
    if (st === 'cinematic' && this.achQueue.length) { this._achBusy = true; setTimeout(() => this._nextAch(), 400); return; }
    const a = this.achQueue.shift();
    const el = this.$('hAch');
    if (!a) { this._achBusy = false; return; }
    this._achBusy = true;
    el.querySelector('.name').textContent = a.name;
    el.querySelector('.desc').textContent = a.desc;
    el.classList.remove('hidden');
    el.animate([{ transform: 'translateX(-120%)', opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }], { duration: 380, easing: 'cubic-bezier(.2,1.4,.4,1)', fill: 'forwards' });
    this.game.audio?.play('bell', { volume: 0.55, rate: 1.25 });
    setTimeout(() => {
      el.animate([{ transform: 'translateX(0)', opacity: 1 }, { transform: 'translateX(-120%)', opacity: 0 }], { duration: 320, easing: 'ease-in', fill: 'forwards' })
        .finished.then(() => { el.classList.add('hidden'); this._nextAch(); }, () => { el.classList.add('hidden'); this._nextAch(); });
    }, 3400);
  }

  /** The ending's title card over the last shot (the closing fade to black covers it). */
  endCard(on) {
    const el = this.$('endCard');
    el.classList.toggle('hidden', !on);
    if (on) el.animate([{ transform: 'scale(1.18)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 1100, easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'forwards' });
  }

  /** The Achievements screen: every achievement, earned ones lit. */
  showAchievements(list) {
    const got = list.filter((a) => a.got).length;
    this.$('achCount').textContent = `${got} / ${list.length}`;
    this.$('achList').innerHTML = list.map((a) => `<div class="ach ${a.got ? 'got' : ''}"><span class="star">${a.got ? '★' : '☆'}</span><span class="n">${a.name}</span><span class="d">${a.desc}</span></div>`).join('');
    this.show('achievements');
  }

  /** Fade the picture to (1) or back from (0) a colour over `dur` seconds (cutscene cuts; menus sit above it). */
  fade(to, dur = 0.5, color = '#000') {
    const f = this.el.flash;
    f.style.background = color; f.style.transition = `opacity ${dur}s`; f.style.opacity = to;
  }

  letterbox(on) { this.el.letterbox.classList.toggle('on', on); this.el.skip.classList.toggle('hidden', !on); this.el.hud.classList.toggle('cine', on); }

  update(dt) {
    const g = this.game;
    const s = g.score;
    if (!s) return;
    // animated score counter
    this.shownScore += (s.score - this.shownScore) * Math.min(1, dt * 8);
    if (Math.abs(s.score - this.shownScore) < 1) this.shownScore = s.score;
    this.el.score.textContent = Math.round(this.shownScore).toLocaleString('en-US');
    const mult = s.multiplier;
    const comboOn = s.comboTimer > 0 && s.chain > 1;
    this.el.combo.classList.toggle('hidden', !comboOn);
    this.el.comboBarW.classList.toggle('hidden', !comboOn);
    if (comboOn) {
      const txt = `x${mult} CHAIN ×${s.chain}`;
      if (this.el.combo.textContent !== txt) { this.el.combo.textContent = txt; this.el.combo.style.transform = 'scale(1.35)'; }
      else this.el.combo.style.transform = `scale(${1 + (parseFloat(this.el.combo.style.transform.slice(6)) - 1 || 0) * 0.85})`;
      this.el.comboBar.style.width = `${(s.comboTimer / s.rules.comboWindow) * 100}%`;
    }
    const doom = s.ruinPercent;
    this.el.doom.style.width = `${doom}%`;
    this.el.doomPct.textContent = `${doom}%`;
    const r = g.rage.value;
    this.el.rage.style.width = `${r}%`;
    this.el.ragePct.textContent = Math.round(r);
    const ph = g.rage.phase;
    this.el.ragePhase.textContent = RAGE_NAMES[ph];
    this.el.mood.textContent = g.granny?.state === 'holding' ? 'gloating' : GRANNY_MOODS[ph];
    this.el.rageBox.classList.toggle('shake', ph >= 3);
    // popups
    const cam = g.camera;
    const w = window.innerWidth, h = window.innerHeight;
    for (const p of this.popups) {
      p.t += dt;
      const v = p.pos.clone(); v.y += p.t * 0.6;
      v.project(cam);
      const vis = v.z < 1;
      p.d.style.display = vis ? 'block' : 'none';
      p.d.style.left = `${(v.x * 0.5 + 0.5) * w}px`;
      p.d.style.top = `${(-v.y * 0.5 + 0.5) * h}px`;
      p.d.style.opacity = Math.max(0, 1 - Math.max(0, p.t - 0.9) / 0.6);
    }
    this.popups = this.popups.filter((p) => { if (p.t > 1.5) { p.d.remove(); return false; } return true; });
    this.el.lock.classList.toggle('hidden', !(g.state === 'playing' && !g.input.locked));
    this.el.fps.classList.toggle('hidden', !this.settings.fps);
  }

  results(data) {
    this.$('rLbl').textContent = data.label ?? 'YOUR CHAOS RANK';
    this.$('results').classList.toggle('caught', !!data.caught);
    this.$('rRank').textContent = data.rank;
    this.$('rScore').textContent = data.score.toLocaleString('en-US');
    this.$('rPB').classList.toggle('hidden', !data.newBest);
    this.$('rQuote').textContent = data.quote ?? '';
    this.$('rStats').innerHTML = data.stats.map(([k, v]) => `<span>${k}</span><span class="v">${v}</span>`).join('');
    const ach = data.achievements;
    this.$('rAch').innerHTML = !ach ? '' : `<span class="cnt">Achievements ${ach.got} / ${ach.total}</span>${ach.run.length
      ? ' · ' + ach.run.map((a) => `<span class="${a.fresh ? 'fresh' : ''}">${a.fresh ? '★ ' : ''}${a.name}</span>`).join(' · ') : ''}`;
    this.show('results');
  }
}

export { THREE };
