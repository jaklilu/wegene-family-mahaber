const STORAGE_KEY = 'wegene-tracker-mvp-v4';

const $ = (id) => document.getElementById(id);

let data = null;

async function loadSeedData() {
  const [members, state, history] = await Promise.all([
    fetch('data/members.json').then((r) => r.json()),
    fetch('data/state.json').then((r) => r.json()),
    fetch('data/history.json').then((r) => r.json())
  ]);
  return { members, state, history };
}

function save() {
  data.state.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function memberById(id) {
  return data.members.find((m) => m.id === id);
}

function sortedActiveMembers() {
  return [...data.members]
    .filter((m) => m.active && m.hostingEligible)
    .sort((a, b) => a.rotationOrder - b.rotationOrder);
}

function resequenceOrders() {
  sortedActiveMembers().forEach((member, index) => {
    member.rotationOrder = index + 1;
  });
  const current = memberById(data.state.currentMemberId);
  if (current) data.state.mainPointerOrder = current.rotationOrder;
}

function computeMemberStatus(member) {
  if (data.state.scheduled?.memberId === member.id) return 'scheduled';
  if (data.state.currentMemberId === member.id) return 'ready';
  if (data.state.passQueue.includes(member.id)) return 'passed';
  if (data.history.some((h) => h.memberId === member.id && h.round === data.state.round && h.status === 'hosted')) {
    return 'hosted';
  }
  return 'waiting';
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

function memberDate(member) {
  if (data.state.scheduled?.memberId === member.id) return data.state.scheduled.date;
  const hist = data.history.find((h) => h.memberId === member.id && h.round === data.state.round && h.status === 'hosted');
  return hist?.hostingDate || '';
}

function showMessage(text, isError = false) {
  const box = $('admin-message');
  box.hidden = false;
  box.textContent = text;
  box.classList.toggle('error-banner', isError);
  box.classList.toggle('notice', !isError);
}

function nextInMainOrder(afterOrder) {
  const members = sortedActiveMembers();
  return members.find((m) => m.rotationOrder > afterOrder) || members[0];
}

function moveMember(memberId, direction) {
  const members = sortedActiveMembers();
  const index = members.findIndex((m) => m.id === memberId);
  const swapWith = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || swapWith < 0 || swapWith >= members.length) return;
  const a = members[index];
  const b = members[swapWith];
  const tmp = a.rotationOrder;
  a.rotationOrder = b.rotationOrder;
  b.rotationOrder = tmp;
  resequenceOrders();
  save();
  render();
  showMessage(`Moved ${a.name} ${direction}.`);
}

function setGetReady(memberId) {
  const member = memberById(memberId);
  if (!member) return;
  if (data.state.scheduled && !confirm('There is a scheduled hosting. Clear it and set a new Get Ready member?')) return;
  data.state.currentMemberId = member.id;
  data.state.mainPointerOrder = member.rotationOrder;
  data.state.scheduled = null;
  data.state.passQueue = data.state.passQueue.filter((id) => id !== member.id);
  save();
  render();
  showMessage(`${member.name} is now Get Ready.`);
}

function togglePass(memberId) {
  const member = memberById(memberId);
  if (!member) return;
  const inQueue = data.state.passQueue.includes(memberId);
  if (inQueue) {
    data.state.passQueue = data.state.passQueue.filter((id) => id !== memberId);
    showMessage(`${member.name} removed from pass queue.`);
  } else {
    if (data.state.currentMemberId === memberId) {
      return showMessage('Set someone else as Get Ready before marking the current member as Passed.', true);
    }
    data.state.passQueue.push(memberId);
    showMessage(`${member.name} added to pass queue.`);
  }
  save();
  render();
}

function updateMemberDate(memberId, dateValue) {
  const member = memberById(memberId);
  if (!member) return;
  if (!dateValue) return showMessage('Choose a date first.', true);

  if (data.state.scheduled?.memberId === memberId) {
    data.state.scheduled.date = dateValue;
    save();
    render();
    return showMessage(`Updated scheduled date for ${member.name} to ${dateValue}.`);
  }

  const hist = data.history.find((h) => h.memberId === memberId && h.round === data.state.round && h.status === 'hosted');
  if (hist) {
    hist.hostingDate = dateValue;
    save();
    render();
    return showMessage(`Updated hosted date for ${member.name} to ${dateValue}.`);
  }

  if (data.state.currentMemberId === memberId || confirm(`Set ${member.name} as scheduled host for ${dateValue}?`)) {
    data.state.scheduled = { memberId, date: dateValue, status: 'scheduled' };
    if (data.state.currentMemberId !== memberId) {
      data.state.currentMemberId = memberId;
      data.state.mainPointerOrder = member.rotationOrder;
    }
    data.state.passQueue = data.state.passQueue.filter((id) => id !== memberId);
    save();
    render();
    return showMessage(`${member.name} scheduled for ${dateValue}.`);
  }
}

function clearSchedule() {
  if (!data.state.scheduled) return;
  if (!confirm('Clear the scheduled hosting date?')) return;
  const member = memberById(data.state.scheduled.memberId);
  data.state.scheduled = null;
  save();
  render();
  showMessage(`Cleared scheduled date${member ? ` for ${member.name}` : ''}.`);
}

function confirmHosted() {
  const scheduled = data.state.scheduled;
  if (!scheduled) return showMessage('No scheduled hosting to confirm.', true);
  const hostedMember = memberById(scheduled.memberId);
  if (!hostedMember) return;

  data.history.unshift({
    id: `hist-${Date.now()}`,
    memberId: hostedMember.id,
    memberName: hostedMember.name,
    hostingDate: scheduled.date,
    round: data.state.round,
    status: 'hosted',
    notes: 'Confirmed by admin.'
  });
  data.state.lastHostedMemberId = hostedMember.id;
  const hostedOrder = hostedMember.rotationOrder;
  resequenceOrders();
  const maxOrder = Math.max(...sortedActiveMembers().map((m) => m.rotationOrder));

  let next;
  if (data.state.passQueue.length) {
    const nextId = data.state.passQueue.shift();
    next = memberById(nextId);
  } else {
    next = nextInMainOrder(hostedOrder);
  }

  hostedMember.rotationOrder = maxOrder + 1;
  resequenceOrders();
  data.state.currentMemberId = next.id;
  data.state.mainPointerOrder = next.rotationOrder;
  data.state.scheduled = null;
  save();
  render();
  showMessage(`${hostedMember.name} marked hosted. ${next.name} is now Get Ready.`);
}

function markHostedNow(memberId, dateValue) {
  const member = memberById(memberId);
  if (!member) return;
  const date = dateValue || new Date().toISOString().slice(0, 10);
  if (!confirm(`Mark ${member.name} as hosted on ${date} and move them to the bottom?`)) return;

  data.state.scheduled = { memberId: member.id, date, status: 'scheduled' };
  data.state.currentMemberId = member.id;
  data.state.mainPointerOrder = member.rotationOrder;
  data.state.passQueue = data.state.passQueue.filter((id) => id !== member.id);
  confirmHosted();
}

function updateHistoryDate(historyId, dateValue) {
  const item = data.history.find((h) => h.id === historyId);
  if (!item || !dateValue) return;
  item.hostingDate = dateValue;
  save();
  render();
  showMessage(`Updated history date for ${item.memberName} to ${dateValue}.`);
}

function removeHistory(historyId) {
  const item = data.history.find((h) => h.id === historyId);
  if (!item) return;
  if (!confirm(`Remove history entry for ${item.memberName} on ${item.hostingDate}?`)) return;
  data.history = data.history.filter((h) => h.id !== historyId);
  save();
  render();
  showMessage(`Removed history entry for ${item.memberName}.`);
}

function exportJson() {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `wegene-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showMessage('Backup downloaded.');
}

async function resetToSeed() {
  if (!confirm('Reset tracker data in this browser back to the seed files?')) return;
  data = await loadSeedData();
  save();
  render();
  showMessage('Reset to seed data.');
}

function render() {
  const current = memberById(data.state.currentMemberId);
  const scheduled = data.state.scheduled;
  $('admin-current-summary').innerHTML = current
    ? `<strong>${current.name}</strong> is Get Ready.` +
      (scheduled
        ? ` Scheduled: <strong>${memberById(scheduled.memberId)?.name || 'Unknown'}</strong> on <strong>${scheduled.date}</strong>.`
        : ' No hosting date scheduled yet.')
    : 'No current member selected.';

  const actions = $('admin-current-actions');
  actions.innerHTML = `
    ${scheduled ? '<button type="button" class="secondary" id="admin-confirm-hosted">Confirm hosted & advance</button>' : ''}
    ${scheduled ? '<button type="button" class="ghost" id="admin-clear-schedule">Clear schedule</button>' : ''}
  `;
  $('admin-confirm-hosted')?.addEventListener('click', confirmHosted);
  $('admin-clear-schedule')?.addEventListener('click', clearSchedule);

  const members = sortedActiveMembers();
  $('admin-member-table').innerHTML = members.map((member, index) => {
    const status = computeMemberStatus(member);
    const date = memberDate(member);
    return `<tr class="${member.id === data.state.currentMemberId ? 'current' : ''}">
      <td data-label="Order">${index + 1}</td>
      <td data-label="Member" class="name-cell">${member.name}</td>
      <td data-label="Status">${badge(status)}</td>
      <td data-label="Date">
        <input type="date" class="admin-date" data-member-id="${member.id}" value="${date}" aria-label="Date for ${member.name}" />
      </td>
      <td data-label="Manage">
        <div class="admin-row-actions">
          <button type="button" class="ghost small" data-action="up" data-id="${member.id}" ${index === 0 ? 'disabled' : ''}>Up</button>
          <button type="button" class="ghost small" data-action="down" data-id="${member.id}" ${index === members.length - 1 ? 'disabled' : ''}>Down</button>
          <button type="button" class="secondary small" data-action="ready" data-id="${member.id}">Get Ready</button>
          <button type="button" class="ghost small" data-action="pass" data-id="${member.id}">${data.state.passQueue.includes(member.id) ? 'Unpass' : 'Pass'}</button>
          <button type="button" class="warn small" data-action="hosted" data-id="${member.id}">Mark hosted</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  $('admin-member-table').querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = Number(button.dataset.id);
      const action = button.dataset.action;
      if (action === 'up') moveMember(id, 'up');
      if (action === 'down') moveMember(id, 'down');
      if (action === 'ready') setGetReady(id);
      if (action === 'pass') togglePass(id);
      if (action === 'hosted') {
        const dateInput = $(`admin-member-table`).querySelector(`.admin-date[data-member-id="${id}"]`);
        markHostedNow(id, dateInput?.value);
      }
    });
  });

  $('admin-member-table').querySelectorAll('.admin-date').forEach((input) => {
    input.addEventListener('change', () => {
      updateMemberDate(Number(input.dataset.memberId), input.value);
    });
  });

  const passQueue = $('admin-pass-queue');
  const passEmpty = $('admin-pass-empty');
  if (!data.state.passQueue.length) {
    passQueue.innerHTML = '';
    passEmpty.hidden = false;
  } else {
    passEmpty.hidden = true;
    passQueue.innerHTML = data.state.passQueue.map((id, idx) => {
      const member = memberById(id);
      return `<li>
        <strong>${idx + 1}. ${member?.name || id}</strong>
        <button type="button" class="ghost small" data-unpass="${id}">Remove</button>
      </li>`;
    }).join('');
    passQueue.querySelectorAll('[data-unpass]').forEach((button) => {
      button.addEventListener('click', () => togglePass(Number(button.dataset.unpass)));
    });
  }

  const history = $('admin-history-list');
  if (!data.history.length) {
    history.innerHTML = '<li><span>No history yet.</span></li>';
  } else {
    history.innerHTML = data.history.map((item) => `<li class="history-row">
      <div>
        <strong>${item.memberName}</strong>
        <input type="date" class="admin-history-date" data-history-id="${item.id}" value="${item.hostingDate || ''}" />
      </div>
      <button type="button" class="warn small" data-remove-history="${item.id}">Remove</button>
    </li>`).join('');

    history.querySelectorAll('.admin-history-date').forEach((input) => {
      input.addEventListener('change', () => updateHistoryDate(input.dataset.historyId, input.value));
    });
    history.querySelectorAll('[data-remove-history]').forEach((button) => {
      button.addEventListener('click', () => removeHistory(button.dataset.removeHistory));
    });
  }
}

async function bootAdmin() {
  if (!window.WegeneAuth) throw new Error('WegeneAuth failed to load');
  await window.WegeneAuth.requireGate({
    mode: 'admin',
    loginScreenId: 'admin-login-screen',
    appShellId: 'admin-shell',
    passwordInputId: 'admin-password',
    loginButtonId: 'admin-login-button',
    errorId: 'admin-login-error',
    unlockName: 'unlockWegeneAdmin'
  });

  $('admin-logout-button')?.addEventListener('click', () => {
    window.WegeneAuth.clearSession('admin');
    location.reload();
  });

  const seed = await loadSeedData();
  data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || seed;
  if (!Array.isArray(data.members) || !data.state || !Array.isArray(data.history)) {
    data = seed;
  }

  $('export-json')?.addEventListener('click', exportJson);
  $('reset-seed')?.addEventListener('click', () => {
    resetToSeed().catch((err) => {
      console.error(err);
      showMessage('Could not reset to seed data.', true);
    });
  });

  render();
}

bootAdmin().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML(
    'afterbegin',
    '<main class="card"><h1>Could not load admin tools</h1><p>Check that scripts loaded over https/http, not a direct file open.</p></main>'
  );
});
