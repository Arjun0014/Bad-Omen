import './ui/style.css';
import { Game } from './game/Game.js';

const game = new Game(document.getElementById('app'));
window.__game = game; // test / debug hook (read-only use by automated smoke tests)
game.boot().catch((e) => {
  console.error(e);
  const ui = document.getElementById('ui');
  ui.innerHTML = `<div style="color:#f88;padding:2em;font:16px monospace;pointer-events:auto">BAD OMEN failed to start: ${e.message}<br><br>Try a desktop Chrome/Edge/Firefox with WebGL2 enabled, then reload.</div>`;
});
