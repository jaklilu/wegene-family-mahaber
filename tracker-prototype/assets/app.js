const STORAGE_KEY = 'wegene-tracker-mvp-v6';
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

function nextInMainOrder(data, afterOrder) {
  const members = sortedActiveMembers(data);
  return members.find((m) => m.rotationOrder > afterOrder) || members[0];
}

function syncScheduled(data, member) {
  if (!member?.assignedHostDate) {
    data.state.scheduled = null;
    return;
  }
  data.state.scheduled = {
    memberId: member.id,
    date: member.assignedHostDate,
    status: 'scheduled',
    weekday: member.assignedWeekday || 'Sunday'
  };
}

function computeMemberStatus(data, member) {
  if (data.state.passQueue.includes(member.id)) return 'passed';
  if (data.state.currentMemberId === member.id) return 'ready';
  if (member.assignedHostDate) return 'scheduled';
  if (data.history.some((h) => h.memberId === member.id && h.round === data.state.round && h.status === 'hosted')) {
    return 'hosted';
  }
  return 'waiting';
}

function displayDate(data, member) {
  if (member.assignedHostDate && SCHEDULE) return SCHEDULE.formatAssignedLabel(member);
  if (data.state.scheduled?.memberId === member.id) return data.state.scheduled.date;
  const hist = data.history.find((h) => h.memberId === member.id && h.round === data.state.round && h.status === 'hosted');
  return hist?.hostingDate || '—';
}

function save(data) {
  data.state.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function showMessage(text) {
  const box = $('validation-message');
  box.textContent = text;
  box.hidden = false;
}

function setWeekendDay(data, weekday) {
  const current = memberById(data, data.state.currentMemberId);
  if (!current?.assignedHostDate || !SCHEDULE) return;
  const nextDate = SCHEDULE.shiftToWeekendDay(current.assignedHostDate, weekday);
  current.assignedHostDate = nextDate;
  current.assignedWeekday = weekday;
  syncScheduled(data, current);
  save(data);
  render(data);
  showMessage(`${current.name}'s hosting date set to ${nextDate} (${weekday}).`);
}

function shiftCurrentByWeeks(data, weeks) {
  const current = memberById(data, data.state.currentMemberId);
  if (!current?.assignedHostDate || !SCHEDULE) return;
  const shifted = SCHEDULE.shiftByWeeks(current.assignedHostDate, weeks);
  current.assignedHostDate = shifted.date;
  current.assignedWeekday = shifted.weekday;
  syncScheduled(data, current);
  save(data);
  render(data);
  showMessage(`${current.name} moved ${weeks < 0 ? 'one week earlier' : 'one week later'} to ${shifted.date} (${shifted.weekday}).`);
}

function emergencySwap(data, otherMemberId) {
  const current = memberById(data, data.state.currentMemberId);
  const other = memberById(data, Number(otherMemberId));
  if (!current || !other || !SCHEDULE) return;
  if (!current.assignedHostDate || !other.assignedHostDate) {
    return showMessage('Both members need an assigned date to swap.');
  }
  if (!confirm(
    `Emergency swap?\n\n${current.name}: ${current.assignedHostDate}\n${other.name}: ${other.assignedHostDate}\n\n` +
    `They will exchange dates and places in the order. The person with the earlier date becomes Get Ready.`
  )) return;

  SCHEDULE.swapAssignedDates(current, other);
  const earlier = current.assignedHostDate <= other.assignedHostDate ? current : other;
  data.state.currentMemberId = earlier.id;
  data.state.mainPointerOrder = earlier.rotationOrder;
  data.state.passQueue = data.state.passQueue.filter((id) => id !== current.id && id !== other.id);
  syncScheduled(data, earlier);
  save(data);
  render(data);
  showMessage(`Swapped dates between ${current.name} and ${other.name}. ${earlier.name} is now Get Ready for ${earlier.assignedHostDate}.`);
}

function passCurrentMember(data) {
  const current = memberById(data, data.state.currentMemberId);
  if (!current) return;
  if (!confirm(`${current.name} will pass and move into the pass queue. Continue?`)) return;
  if (!data.state.passQueue.includes(current.id)) data.state.passQueue.push(current.id);
  const next = nextInMainOrder(data, current.rotationOrder);
  data.state.currentMemberId = next.id;
  data.state.mainPointerOrder = next.rotationOrder;
  syncScheduled(data, next);
  save(data);
  render(data);
  showMessage(`${current.name} was added to the pass queue. ${next.name} is now Get Ready.`);
}

function confirmHosted(data) {
  const current = memberById(data, data.state.currentMemberId);
  const scheduled = data.state.scheduled || (current?.assignedHostDate
    ? { memberId: current.id, date: current.assignedHostDate, status: 'scheduled' }
    : null);
  if (!scheduled) return showMessage('No assigned hosting date to confirm.');
  const hostedMember = memberById(data, scheduled.memberId);
  data.history.unshift({
    id: `hist-${Date.now()}`,
    memberId: hostedMember.id,
    memberName: hostedMember.name,
    hostingDate: scheduled.date,
    round: data.state.round,
    status: 'hosted',
    notes: 'Confirmed from assigned quarterly schedule.'
  });
  data.state.lastHostedMemberId = hostedMember.id;
  const hostedOrder = hostedMember.rotationOrder;
  const maxOrder = Math.max(...sortedActiveMembers(data).map((member) => member.rotationOrder));
  let next;
  if (data.state.passQueue.length) {
    const nextId = data.state.passQueue.shift();
    next = memberById(data, nextId);
  } else {
    next = nextInMainOrder(data, hostedOrder);
  }
  hostedMember.rotationOrder = maxOrder + 1;
  data.state.currentMemberId = next.id;
  data.state.mainPointerOrder = next.rotationOrder;
  syncScheduled(data, next);
  save(data);
  render(data);
  showMessage(`${hostedMember.name} marked hosted. ${next.name} is now Get Ready${data.state.passQueue.length ? ' from the pass queue' : ''}.`);
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

  $('current-summary').innerHTML = current
    ? `<span class="current-person">${renderAvatar(current)} <strong>${current.name}</strong></span>
       <span class="current-inline-label">You are next</span>${
        scheduled
          ? `<span class="scheduled-line">Assigned date: <strong>${scheduled.date}</strong> (${weekday})</span>`
          : ''
      }`
    : 'No current member selected.';

  const others = sortedActiveMembers(data).filter((m) => m.id !== current?.id && m.assignedHostDate);

  $('current-actions').innerHTML = `
    <div class="option-group">
      <p class="option-label">1. Weekend day</p>
      <div class="actions pair-actions">
        <button type="button" class="ghost" id="set-saturday" ${weekday === 'Saturday' ? 'disabled' : ''}>Saturday</button>
        <button type="button" class="ghost" id="set-sunday" ${weekday === 'Sunday' ? 'disabled' : ''}>Sunday</button>
      </div>
    </div>
    <div class="option-group">
      <p class="option-label">2. Move by one week</p>
      <div class="actions pair-actions">
        <button type="button" class="ghost" id="week-earlier">1 week earlier</button>
        <button type="button" class="ghost" id="week-later">1 week later</button>
      </div>
    </div>
    <div class="option-group">
      <p class="option-label">3. Emergency swap</p>
      <div class="actions swap-actions">
        <select id="swap-member" aria-label="Swap date with member">
          <option value="">Choose member…</option>
          ${others.map((m) => `<option value="${m.id}">${m.name} · ${m.assignedHostDate}</option>`).join('')}
        </select>
        <button type="button" class="secondary" id="swap-button">Swap dates</button>
      </div>
    </div>
    <div class="option-group">
      <p class="option-label">Turn actions</p>
      <div class="actions pair-actions">
        <button type="button" class="secondary" id="confirm-hosted">Confirm hosted</button>
        <button type="button" class="warn" id="pass-button">Pass</button>
      </div>
    </div>
  `;

  $('set-saturday')?.addEventListener('click', () => setWeekendDay(data, 'Saturday'));
  $('set-sunday')?.addEventListener('click', () => setWeekendDay(data, 'Sunday'));
  $('week-earlier')?.addEventListener('click', () => shiftCurrentByWeeks(data, -1));
  $('week-later')?.addEventListener('click', () => shiftCurrentByWeeks(data, 1));
  $('swap-button')?.addEventListener('click', () => {
    const value = $('swap-member')?.value;
    if (!value) return showMessage('Choose a family member to swap with first.');
    emergencySwap(data, value);
  });
  $('confirm-hosted')?.addEventListener('click', () => confirmHosted(data));
  $('pass-button')?.addEventListener('click', () => passCurrentMember(data));

  const activeMembers = sortedActiveMembers(data);
  $('member-table').innerHTML = activeMembers.map((member, index) => {
    const status = computeMemberStatus(data, member);
    return `<tr class="${member.id === data.state.currentMemberId ? 'current' : ''}">
      <td data-label="Order">${index + 1}</td>
      <td data-label="Member" class="name-cell">${renderAvatar(member)} ${member.name}</td>
      <td data-label="Status">${badge(status)}</td>
      <td data-label="Date">${displayDate(data, member)}</td>
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
  let data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || seed;
  render(data);
}

boot().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML(
    'afterbegin',
    '<main class="card"><h1>Could not load prototype data</h1><p>Run through a local web server, not direct file open. See README.md.</p></main>'
  );
});
