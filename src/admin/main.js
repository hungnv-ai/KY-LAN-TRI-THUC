import { h } from '../ui/dom.js';
import { getSession, isOnlineConfigured, signInWithGoogle, signOut } from '../net/supabase.js';
import { api } from './api.js';
import { renderBell } from './pages/bell.js';
import { renderDashboard } from './pages/dashboard.js';
import { ROLES, renderPlayers } from './pages/players.js';
import { renderQuestions } from './pages/questions.js';
import { renderSettings } from './pages/settings.js';
import { grantVoucherDialog, renderVouchers } from './pages/vouchers.js';

/**
 * Trang quản trị Kỳ Lân Tri Thức (admin.html) — bố cục theo chuẩn hệ thống nội bộ VA:
 * sidebar (Logo + tên hệ thống → Tổng quan → chức năng chính → Cấu hình & phân quyền cuối cùng).
 */

const app = document.getElementById('app');

/** Mục menu: `roles` = vai trò được thấy. */
const NAV = [
  { id: 'dashboard', icon: '📊', label: 'Tổng quan', roles: ['teacher', 'bgh', 'admin'], render: renderDashboard },
  { id: 'questions', icon: '❓', label: 'Ngân hàng câu hỏi', roles: ['teacher', 'bgh', 'admin'], render: renderQuestions },
  { id: 'players', icon: '👥', label: 'Người chơi', roles: ['teacher', 'bgh', 'admin'], render: renderPlayers },
  { id: 'bell', icon: '🔔', label: 'Rung Chuông Vàng', roles: ['bgh', 'admin'], render: renderBell },
  { id: 'vouchers', icon: '🎟️', label: 'Phiếu quà', roles: ['bgh', 'admin'], render: renderVouchers },
  { id: 'settings', icon: '⚙️', label: 'Cài đặt & phân quyền', roles: ['bgh', 'admin'], render: renderSettings, bottom: true },
];

boot().catch((err) => {
  console.error(err);
  app.replaceChildren(centerCard('⚠️', 'Có lỗi khi tải trang', err.message ?? String(err)));
});

async function boot() {
  if (!isOnlineConfigured) {
    app.replaceChildren(
      centerCard('🔌', 'Chưa kết nối máy chủ', 'Trang quản trị cần Supabase. Làm theo docs/HUONG_DAN_TRIEN_KHAI.md (bước Supabase) rồi tải lại trang.'),
    );
    return;
  }
  const session = await getSession();
  if (!session) {
    const btn = h('button', { class: 'btn', type: 'button', onclick: () => signInWithGoogle() }, 'Đăng nhập bằng Google');
    app.replaceChildren(centerCard('🔐', 'Quản trị Kỳ Lân Tri Thức', 'Đăng nhập bằng tài khoản Google của trường.', btn));
    return;
  }

  const state = await api.myState(); // tạo hồ sơ nếu chưa có + kiểm tra tên miền
  const role = state.profile.role;
  const profile = state.profile;

  if (!['teacher', 'bgh', 'admin'].includes(role)) {
    const claim = h('button', { class: 'btn', type: 'button' }, 'Tôi là người cài đặt — nhận quyền Quản trị');
    claim.addEventListener('click', async () => {
      claim.disabled = true;
      const res = await api.claimFirstAdmin().catch((e) => ({ ok: false, reason: e.message }));
      if (res.ok) window.location.reload();
      else {
        claim.replaceWith(h('p', { class: 'notice' }, 'Hệ thống đã có Quản trị. Hãy nhờ Quản trị hoặc BGH cấp quyền cho bạn tại trang Người chơi.'));
      }
    });
    app.replaceChildren(
      centerCard(
        '🚫',
        'Bạn chưa có quyền quản trị',
        `Tài khoản ${profile.email} đang là Người chơi. Trang này dành cho Giáo viên, Ban Giám hiệu và Quản trị.`,
        claim,
        h('p', {}, h('a', { class: 'link', href: '/' }, '← Về trang game')),
      ),
    );
    return;
  }

  renderShell({ role, profile });
}

function renderShell({ role, profile }) {
  const items = NAV.filter((n) => n.roles.includes(role));
  const main = h('main', { class: 'main', id: 'main', tabindex: -1 });
  const title = h('h1', { class: 'page-title' });
  const sidebar = h(
    'aside',
    { class: 'sidebar', id: 'sidebar' },
    h(
      'div',
      { class: 'brand' },
      h('img', { src: '/mascot-icon.png', alt: '', width: 32, height: 44 }),
      h('div', {}, h('strong', {}, 'Kỳ Lân Tri Thức'), h('small', {}, 'Quản trị · VA Schools')),
    ),
    h(
      'nav',
      { class: 'side-nav', 'aria-label': 'Chức năng' },
      items.filter((n) => !n.bottom).map(navLink),
      h('div', { class: 'side-spacer' }),
      items.filter((n) => n.bottom).map(navLink),
    ),
  );

  function navLink(n) {
    return h('a', { href: `#${n.id}`, class: 'side-link', 'data-id': n.id }, h('span', { 'aria-hidden': 'true' }, n.icon), n.label);
  }

  const menuBtn = h('button', { class: 'icon-btn menu-btn', type: 'button', 'aria-label': 'Mở menu', 'aria-controls': 'sidebar' }, '☰');
  menuBtn.addEventListener('click', () => document.body.classList.toggle('nav-open'));

  const navbar = h(
    'header',
    { class: 'navbar' },
    menuBtn,
    title,
    h('div', { class: 'nav-spacer' }),
    h('a', { class: 'btn-sm', href: '/' }, '🎮 Vào game'),
    h(
      'div',
      { class: 'me' },
      h('div', { class: 'me-text' }, h('strong', {}, profile.displayName ?? profile.fullName ?? profile.email), h('small', {}, ROLES[role].label)),
      h('button', { class: 'btn-sm', type: 'button', onclick: async () => { await signOut(); window.location.reload(); } }, 'Đăng xuất'),
    ),
  );

  app.replaceChildren(sidebar, h('div', { class: 'content' }, navbar, main), h('div', { class: 'nav-scrim', onclick: () => document.body.classList.remove('nav-open') }));

  async function route() {
    const id = window.location.hash.slice(1) || items[0].id;
    const page = items.find((n) => n.id === id) ?? items[0];
    sidebar.querySelectorAll('.side-link').forEach((a) => a.setAttribute('aria-current', a.dataset.id === page.id ? 'page' : 'false'));
    title.textContent = page.label;
    document.title = `${page.label} – Quản trị Kỳ Lân Tri Thức`;
    document.body.classList.remove('nav-open');
    main.replaceChildren(h('p', { class: 'muted' }, 'Đang tải…'));
    try {
      await page.render(main, { role, onGrantVoucher: grantVoucherDialog });
    } catch (err) {
      main.replaceChildren(h('p', { class: 'notice notice-danger' }, err.message ?? String(err)));
    }
    main.focus({ preventScroll: true });
  }
  window.addEventListener('hashchange', route);
  route();
}

function centerCard(icon, title, message, ...extra) {
  return h(
    'div',
    { class: 'center' },
    h('div', { class: 'card center-card' }, h('div', { class: 'big-emoji', 'aria-hidden': 'true' }, icon), h('h1', {}, title), h('p', { class: 'muted' }, message), ...extra),
  );
}
