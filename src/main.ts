import './styles.css';
import { boot } from './app/bootstrap';
void boot().catch(error => {
 console.error('Unable to initialize Block Workshop', error);
 // Fatal startup fallback only; all ordinary game UI lives in Phaser.
 const root = document.getElementById('app');
 if (root) { root.textContent = 'Не удалось запустить игру. Обновите страницу. / Unable to start. Reload to retry.'; root.dataset['error'] = 'true'; }
});
