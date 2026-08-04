const STORAGE_KEY = 'wegene-tracker-mvp-v9';
const DAY_MS = 24 * 60 * 60 * 1000;
const CHANGE_LOCK_DAYS = 30;
const AUTH = window.WegeneAuth;
const SCHEDULE = window.WegeneSchedule;

const $ = (id) => document.getElementById(id);

async function setupLoginGate() {
  if (!AUTH) throw new Error('WegeneAuth failed to load');
  return AUTH.requireGate({
    mode: 'member',
    loginScreenId: 'login-screen',
    appShellId: 'app-shell',
    passwordInputId: 'member-password',
    loginButtonId: 'login-button',
    errorId: 'login-error',
    unlockName: 'unlockWegeneTracker'
  });
}

async function loadSeedData() {
  const [members, state, history] = await Promise.all([
    fetch('data/members.json').then((r) => r.json()),
    fetch('data/state.json').then((r) => r.json()),
    fetch('data/history.json').then((r) => r.json())
  ]);
  return { members, state, history };
}

function getInitials(name) {
  return name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

function badge(status) {
  const map = {
    hosted: ['hosted', 'Hosted'],
    ready: ['ready', 'Get Ready'],
    scheduled: ['scheduled', 'Scheduled'],
    confirmed: ['confirmed', 'Confirmed'],
    passed: ['passed', 'Passed'],
    waiting: ['waiting', 'Waiting']
  };
  const [cls, label] = map[status] || map.waiting;
  return `<span class="badge ${cls}">${label}</span>`;
}

function memberById(data, id) {
  return data.members.find((m) => m.id === id);
}

function sortedActiveMembers(data) {
  return [...data.members]
    .filter((m) => m.active && m.hostingEligible)
    .sort((a, b) => a.rotationOrder - b.rotationOrder);
}

function syncScheduled(data, member, options = {}) {
  if (!member?.assignedHostDate) {
    data.state.scheduled = null;
    return;
  }
  data.state.scheduled = {
    memberId: member.id,
    date: member.assignedHostDate,
    status: member.dateConfirmed ? 'confirmed' : 'scheduled',
    weekday: member.assignedWeekday || 'Sunday',
    confirmed: Boolean(member.dateConfirmed)
  };
  if (options.confirm) {
    member.dateConfirmed = true;
    data.state.scheduled.confirmed = true;
    data.state.scheduled.status = 'confirmed';
  }
}

function computeMemberStatus(data, member) {
  if (data.state.passQueue.includes(member.id)) return 'passed';
  if (member.dateConfirmed) return 'confirmed';
  if (data.state.currentMemberId === member.id) return 'ready';
  if (member.assignedHostDate) return 'scheduled';
  if (data.history.some((h) => h.memberId === member.id && h.round === data.state.round && h.status === 'hosted')) {
    return 'hosted';
  }
  return 'waiting';
}

function displayDate(data, member) {
  if (member.assignedHostDate && SCHEDULE) return SCHEDULE.formatAssignedLabel(member);
  if (data.state.scheduled?.memberId === member.id) {
    return SCHEDULE ? SCHEDULE.formatDisplayDate(data.state.scheduled.date) : data.state.scheduled.date;
  }
  const hist = data.history.find((h) => h.memberId === member.id && h.round === data.state.round && h.status === 'hosted');
  if (!hist?.hostingDate) return '—';
  return SCHEDULE ? SCHEDULE.formatDisplayDate(hist.hostingDate) : hist.hostingDate;
}

function save(data) {
  if (window.WegeneStore) {
    window.WegeneStore.saveTrackerData(STORAGE_KEY, data);
    return;
  }
  data.state.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function showMessage(text) {
  const box = $('validation-message');
  box.textContent = text;
  box.hidden = false;
}

function prettyDate(isoDate) {
  return SCHEDULE ? SCHEDULE.formatDisplayDate(isoDate) : isoDate;
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function daysUntilHostDate(isoDate) {
  if (!isoDate || !SCHEDULE) return null;
  const host = SCHEDULE.parseISODate(isoDate);
  if (Number.isNaN(host.getTime())) return null;
  return Math.ceil((host.getTime() - startOfToday().getTime()) / DAY_MS);
}

function isDateChangeLocked(isoDate) {
  const days = daysUntilHostDate(isoDate);
  return days !== null && days <= CHANGE_LOCK_DAYS;
}

function changeWindowLabel(isoDate) {
  const days = daysUntilHostDate(isoDate);
  if (days === null) return '';
  if (days <= CHANGE_LOCK_DAYS) {
    return `Dates locked · under ${CHANGE_LOCK_DAYS} days`;
  }
  const left = days - CHANGE_LOCK_DAYS;
  return left === 1 ? '1 day left to change' : `${left} days left to change`;
}

function confirmCurrentHost(data) {
  const current = memberById(data, data.state.currentMemberId);
  if (!current?.assignedHostDate) return;
  syncScheduled(data, current, { confirm: true });
  save(data);
  hideDateConfirm();
  hideSwapConfirm();
  render(data);
}

function guardDateChanges(data) {
  const current = memberById(data, data.state.currentMemberId);
  if (!current?.assignedHostDate) return false;
  if (!isDateChangeLocked(current.assignedHostDate)) return true;
  showMessage(`Date changes are locked within ${CHANGE_LOCK_DAYS} days of the mahaber.`);
  return false;
}

function setWeekendDay(data, weekday) {
  if (!guardDateChanges(data)) return;
  const current = memberById(data, data.state.currentMemberId);
  if (!current?.assignedHostDate || !SCHEDULE) return;
  const nextDate = SCHEDULE.shiftToWeekendDay(current.assignedHostDate, weekday);
  requestDateConfirm({
    label: weekday === 'Saturday' ? 'Change to Saturday?' : 'Change back to Sunday?',
    date: nextDate,
    onConfirm: () => {
      current.assignedHostDate = nextDate;
      current.assignedWeekday = weekday;
      syncScheduled(data, current, { confirm: true });
      save(data);
      hideDateConfirm();
      render(data);
    }
  });
}

function shiftCurrentByWeeks(data, weeks) {
  if (!guardDateChanges(data)) return;
  const current = memberById(data, data.state.currentMemberId);
  if (!current?.assignedHostDate || !SCHEDULE) return;
  const shifted = SCHEDULE.shiftByWeeks(current.assignedHostDate, weeks);
  requestDateConfirm({
    label: weeks < 0 ? 'Move one week earlier?' : 'Move one week later?',
    date: shifted.date,
    onConfirm: () => {
      current.assignedHostDate = shifted.date;
      current.assignedWeekday = shifted.weekday;
      syncScheduled(data, current, { confirm: true });
      save(data);
      hideDateConfirm();
      render(data);
    }
  });
}

function hideDateConfirm() {
  const panel = $('date-confirm');
  if (panel) panel.hidden = true;
  const button = $('date-confirm-button');
  if (button) button.onclick = null;
}

function requestDateConfirm({ label, date, onConfirm }) {
  hideSwapConfirm();
  const panel = $('date-confirm');
  const labelEl = $('date-confirm-label');
  const dateEl = $('date-confirm-date');
  const button = $('date-confirm-button');
  const message = $('validation-message');
  if (!panel || !labelEl || !dateEl || !button) return;

  if (message) message.hidden = true;
  labelEl.textContent = label;
  labelEl.hidden = false;
  dateEl.textContent = prettyDate(date);
  dateEl.hidden = false;
  panel.hidden = false;
  button.onclick = () => {
    button.onclick = null;
    onConfirm();
  };
}

function hideSwapConfirm() {
  const panel = $('swap-confirm');
  if (panel) panel.hidden = true;
  hideDateConfirm();
}

function showSwapConfirm(other) {
  const panel = $('swap-confirm');
  const text = $('swap-confirm-text');
  if (!panel || !text) return;
  hideDateConfirm();
  text.textContent = `Have you confirmed with ${other.name}?`;
  panel.hidden = false;
}

function applyEmergencySwap(data, otherMemberId) {
  const current = memberById(data, data.state.currentMemberId);
  const other = memberById(data, Number(otherMemberId));
  if (!current || !other || !SCHEDULE) return;
  if (!current.assignedHostDate || !other.assignedHostDate) {
    return showMessage('Both members need an assigned date to swap.');
  }

  SCHEDULE.swapAssignedDates(current, other);
  current.dateConfirmed = false;
  other.dateConfirmed = false;

  const earlier = current.assignedHostDate <= other.assignedHostDate ? current : other;
  data.state.currentMemberId = earlier.id;
  data.state.mainPointerOrder = earlier.rotationOrder;
  data.state.passQueue = data.state.passQueue.filter((id) => id !== current.id && id !== other.id);
  syncScheduled(data, earlier);
  save(data);
  hideSwapConfirm();
  render(data);
}

function requestEmergencySwap(data, otherMemberId) {
  if (!guardDateChanges(data)) return;
  const current = memberById(data, data.state.currentMemberId);
  const other = memberById(data, Number(otherMemberId));
  if (!current) return;
  if (!other) return showMessage('Choose a family member to swap with first.');
  if (!other.assignedHostDate || !current.assignedHostDate) {
    return showMessage('Both members need an assigned date to swap.');
  }

  showSwapConfirm(other);

  const yes = $('swap-yes');
  const no = $('swap-no');
  if (!yes || !no) return;

  yes.onclick = () => {
    yes.onclick = null;
    no.onclick = null;
    applyEmergencySwap(data, otherMemberId);
  };
  no.onclick = () => {
    yes.onclick = null;
    no.onclick = null;
    hideSwapConfirm();
    showMessage(`Swap cancelled. Confirm with ${other.name} first.`);
  };
}

function renderAvatar(member) {
  if (member.photo) return `<span class="avatar"><img src="${member.photo}" alt="${member.name}" /></span>`;
  return `<span class="avatar" aria-hidden="true">${getInitials(member.name)}</span>`;
}

function render(data) {
  const current = memberById(data, data.state.currentMemberId);
  if (current && !data.state.scheduled) syncScheduled(data, current);
  const scheduled = data.state.scheduled;
  const weekday = current?.assignedWeekday || scheduled?.weekday || 'Sunday';
  const hostDate = current?.assignedHostDate || scheduled?.date;
  const changesLocked = isDateChangeLocked(hostDate);
  const timerText = changeWindowLabel(hostDate);
  const lockedAttr = changesLocked ? 'disabled' : '';

  $('current-summary').innerHTML = current
    ? `<span class="mahaber-label">Our next mahaber is...</span>
       ${scheduled ? `<span class="scheduled-line">${prettyDate(scheduled.date)}</span>` : ''}
       <span class="current-person"><strong>${current.name}</strong> <span class="current-inline-label">- ${current.dateConfirmed ? 'Confirmed' : 'You Are Next'}</span></span>`
    : 'No current member selected.';

  const others = sortedActiveMembers(data).filter((m) => m.id !== current?.id && m.assignedHostDate);

  $('current-actions').innerHTML = `
    <div class="actions clean-actions">
      <button type="button" class="ghost" id="toggle-weekend" ${lockedAttr}>
        ${weekday === 'Sunday' ? 'Change to Saturday' : 'Change back to Sunday'}
      </button>
      <button type="button" class="ghost" id="week-earlier" ${lockedAttr}>1 week earlier</button>
      <button type="button" class="ghost" id="week-later" ${lockedAttr}>1 week later</button>
    </div>
    <div class="actions swap-actions">
      <select id="swap-member" aria-label="Swap date with member" ${lockedAttr}>
        <option value="">Swap with…</option>
        ${others.map((m) => `<option value="${m.id}">${m.name} · ${prettyDate(m.assignedHostDate)}</option>`).join('')}
      </select>
      <button type="button" class="secondary" id="swap-button" ${lockedAttr}>Swap dates</button>
    </div>
    <div class="actions host-confirm-row">
      ${current?.dateConfirmed
        ? '<button type="button" class="yes-button" id="host-confirm-button" disabled>Confirmed</button>'
        : '<button type="button" class="yes-button" id="host-confirm-button">Confirm</button>'}
      <span class="change-timer${changesLocked ? ' is-locked' : ''}" id="change-timer">${timerText}</span>
    </div>
  `;

  $('toggle-weekend')?.addEventListener('click', () => {
    setWeekendDay(data, weekday === 'Sunday' ? 'Saturday' : 'Sunday');
  });
  $('week-earlier')?.addEventListener('click', () => shiftCurrentByWeeks(data, -1));
  $('week-later')?.addEventListener('click', () => shiftCurrentByWeeks(data, 1));
  $('swap-button')?.addEventListener('click', () => {
    const value = $('swap-member')?.value;
    if (!value) return showMessage('Choose a family member to swap with first.');
    requestEmergencySwap(data, value);
  });
  $('host-confirm-button')?.addEventListener('click', () => {
    if (current?.dateConfirmed) return;
    confirmCurrentHost(data);
  });

  const activeMembers = sortedActiveMembers(data);
  $('member-table').innerHTML = activeMembers.map((member, index) => {
    const status = computeMemberStatus(data, member);
    return `<tr class="${member.id === data.state.currentMemberId ? 'current' : ''}">
      <td data-label="Order">${index + 1}</td>
      <td data-label="Member" class="name-cell">${renderAvatar(member)} ${member.name}</td>
      <td data-label="Status">${badge(status)}</td>
      <td data-label="Date" class="date-cell">${displayDate(data, member)}</td>
    </tr>`;
  }).join('');

  const callList = $('member-call-list');
  if (callList) {
    callList.innerHTML = activeMembers.map((member) => {
      const phone = member.phone && member.phone !== '(private)' ? member.phone : 'Phone pending approved data';
      return `<li><strong>${member.name}</strong><span>${phone}</span></li>`;
    }).join('');
  }
}

async function boot() {
  await setupLoginGate();
  if (window.WegeneMenu) window.WegeneMenu.setupMenu('menu-toggle', 'site-menu');
  $('logout-button').addEventListener('click', () => {
    AUTH.clearSession('member');
    location.reload();
  });
  const seed = await loadSeedData();
  const loaded = window.WegeneStore
    ? await window.WegeneStore.loadTrackerData(STORAGE_KEY, seed)
    : { data: JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || seed };
  let data = loaded.data;
  render(data);
}

boot().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML(
    'afterbegin',
    '<main class="card"><h1>Could not load prototype data</h1><p>Run through a local web server, not direct file open. See README.md.</p></main>'
  );
});
