function pad(value) {
  return String(value).padStart(2, '0');
}

function formatDateResult(date) {
  const utcMs = date.getTime();
  const china = new Date(utcMs + 8 * 60 * 60 * 1000);
  const year = china.getUTCFullYear();
  const month = pad(china.getUTCMonth() + 1);
  const day = pad(china.getUTCDate());
  const hour = pad(china.getUTCHours());
  const minute = pad(china.getUTCMinutes());

  return {
    iso: `${year}-${month}-${day}T${hour}:${minute}:00.000+08:00`,
    display: `${year}-${month}-${day} ${hour}:${minute}`,
  };
}

function parseSlotStart(date, timeSlot) {
  const [start] = timeSlot.split('-');
  const [hour, minute] = start.split(':').map(Number);
  return new Date(`${date}T${pad(hour)}:${pad(minute)}:00+08:00`);
}

function calculateExpectedEndTime(date, timeSlot, durationMinutes) {
  const startDate = parseSlotStart(date, timeSlot);
  const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
  return formatDateResult(endDate);
}

function calculateOvertime(includedMinutes, actualMinutes, unitFee, unitMinutes) {
  const overtimeMinutes = Math.max(0, actualMinutes - includedMinutes);

  if (overtimeMinutes <= unitMinutes) {
    return {
      overtimeMinutes: 0,
      fee: 0,
      billableUnits: 0,
    };
  }

  const billableUnits = Math.ceil(overtimeMinutes / unitMinutes);
  return {
    overtimeMinutes,
    fee: billableUnits * unitFee,
    billableUnits,
  };
}

function normalizeMember(member) {
  const principalBalance = Number(member.principalBalance || 0);
  const bonusBalance = Number(member.bonusBalance || 0);

  return {
    ...member,
    principalBalance,
    bonusBalance,
    totalBalance: principalBalance + bonusBalance,
    totalRecharge: Number(member.totalRecharge || 0),
    totalBonus: Number(member.totalBonus || 0),
    totalSpent: Number(member.totalSpent || 0),
  };
}

function applyRecharge(member, plan) {
  const current = normalizeMember(member);
  const rechargeAmount = Number(plan.rechargeAmount || 0);
  const bonusAmount = Number(plan.bonusAmount || 0);
  const next = {
    ...current,
    principalBalance: current.principalBalance + rechargeAmount,
    bonusBalance: current.bonusBalance + bonusAmount,
    totalRecharge: current.totalRecharge + rechargeAmount,
    totalBonus: current.totalBonus + bonusAmount,
  };
  next.totalBalance = next.principalBalance + next.bonusBalance;

  return {
    member: next,
    transaction: {
      type: 'recharge',
      amount: rechargeAmount + bonusAmount,
      principalDelta: rechargeAmount,
      bonusDelta: bonusAmount,
      principalBalanceAfter: next.principalBalance,
      bonusBalanceAfter: next.bonusBalance,
      totalBalanceAfter: next.totalBalance,
      reason: `充值 ${rechargeAmount} 赠送 ${bonusAmount}`,
    },
  };
}

function spendBalance(member, amount, reason) {
  const current = normalizeMember(member);
  const spendAmount = Number(amount || 0);

  if (current.totalBalance < spendAmount) {
    throw new Error('余额不足，无法完成本次扣款');
  }

  const bonusPaid = Math.min(current.bonusBalance, spendAmount);
  const principalPaid = spendAmount - bonusPaid;
  const next = {
    ...current,
    bonusBalance: current.bonusBalance - bonusPaid,
    principalBalance: current.principalBalance - principalPaid,
    totalSpent: current.totalSpent + spendAmount,
  };
  next.totalBalance = next.principalBalance + next.bonusBalance;

  return {
    member: next,
    transaction: {
      type: 'consume',
      amount: -spendAmount,
      principalDelta: -principalPaid,
      bonusDelta: -bonusPaid,
      principalBalanceAfter: next.principalBalance,
      bonusBalanceAfter: next.bonusBalance,
      totalBalanceAfter: next.totalBalance,
      reason,
    },
  };
}

function createAppointmentSummary(appointment) {
  const expectedEndTime = calculateExpectedEndTime(
    appointment.appointmentDate,
    appointment.timeSlot,
    appointment.durationMinutes,
  );
  const tags = [`${appointment.peopleCount} 人`, appointment.packageName];

  if (appointment.isMeituan) {
    tags.push('美团来源');
  }

  if (appointment.meituanCode) {
    tags.push(`券码 ${appointment.meituanCode}`);
  }

  return {
    title: `${appointment.name}的预约`,
    packageName: appointment.packageName,
    appointmentDate: appointment.appointmentDate,
    timeSlot: appointment.timeSlot,
    peopleCount: appointment.peopleCount,
    expectedEndTime,
    tags,
  };
}

module.exports = {
  calculateExpectedEndTime,
  calculateOvertime,
  applyRecharge,
  spendBalance,
  createAppointmentSummary,
};
