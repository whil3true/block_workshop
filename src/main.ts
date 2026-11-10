import './styles/tokens.css';
import './styles/board.css';
import './styles/tray.css';
import './styles/drag.css';
import './styles/hud.css';
import './styles/overlay.css';
import './styles/combo.css';
import './styles/app.css';
import { boot } from './app/bootstrap';
void boot().catch(() => {
 const root = document.getElementById('boot');
 if (root) { root.textContent = 'Платформа недоступна. Обновите страницу. / Platform unavailable. Reload to retry.'; root.dataset['error'] = 'true'; }
});
