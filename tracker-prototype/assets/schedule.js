(function () {
  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function toISODate(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function parseISODate(value) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function weekdayName(date) {
    return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
  }

  function firstWeekdayOfMonth(year, monthIndex, weekday) {
    const target = weekday === 'Saturday' ? 6 : 0;
    const date = new Date(year, monthIndex, 1);
    const delta = (target - date.getDay() + 7) % 7;
    date.setDate(1 + delta);
    return date;
  }

  function shiftToWeekendDay(isoDate, weekday) {
    const date = parseISODate(isoDate);
    const day = date.getDay();
    if (weekday === 'Saturday') {
      if (day === 6) return toISODate(date);
      if (day === 0) {
        date.setDate(date.getDate() - 1);
        return toISODate(date);
      }
    }
    if (weekday === 'Sunday') {
      if (day === 0) return toISODate(date);
      if (day === 6) {
        date.setDate(date.getDate() + 1);
        return toISODate(date);
      }
    }
    return toISODate(date);
  }

  function shiftByWeeks(isoDate, weeks) {
    const date = parseISODate(isoDate);
    date.setDate(date.getDate() + (Number(weeks) * 7));
    return {
      date: toISODate(date),
      weekday: weekdayName(date)
    };
  }

  function swapAssignedDates(memberA, memberB) {
    const dateA = memberA.assignedHostDate;
    const weekdayA = memberA.assignedWeekday;
    const orderA = memberA.rotationOrder;

    memberA.assignedHostDate = memberB.assignedHostDate;
    memberA.assignedWeekday = memberB.assignedWeekday;
    memberA.rotationOrder = memberB.rotationOrder;

    memberB.assignedHostDate = dateA;
    memberB.assignedWeekday = weekdayA;
    memberB.rotationOrder = orderA;

    return [memberA, memberB];
  }

  function assignQuarterlyDates(members, options = {}) {
    const start = options.startMonth || '2026-11';
    const [startYear, startMonth] = start.split('-').map(Number);
    const weekday = options.defaultWeekday || 'Sunday';
    let year = startYear;
    let monthIndex = startMonth - 1;

    const ordered = [...members]
      .filter((m) => m.active && m.hostingEligible)
      .sort((a, b) => a.rotationOrder - b.rotationOrder);

    ordered.forEach((member) => {
      const date = firstWeekdayOfMonth(year, monthIndex, weekday);
      member.assignedHostDate = toISODate(date);
      member.assignedWeekday = weekday;
      monthIndex += options.intervalMonths || 3;
      while (monthIndex > 11) {
        monthIndex -= 12;
        year += 1;
      }
    });

    return ordered;
  }

  function formatDisplayDate(isoDate) {
    if (!isoDate) return '—';
    const date = parseISODate(isoDate);
    if (Number.isNaN(date.getTime())) return isoDate;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${weekdayName(date)} ${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  }

  function formatAssignedLabel(member) {
    if (!member?.assignedHostDate) return '—';
    return formatDisplayDate(member.assignedHostDate);
  }

  window.WegeneSchedule = {
    toISODate,
    parseISODate,
    weekdayName,
    firstWeekdayOfMonth,
    shiftToWeekendDay,
    shiftByWeeks,
    swapAssignedDates,
    assignQuarterlyDates,
    formatDisplayDate,
    formatAssignedLabel
  };
}());
