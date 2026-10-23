const ACTIVE_APPOINTMENT_STATUSES = new Set(['pending', 'confirmed', 'arrived']);
const ACTIVE_ACTIVITY_STATUSES = new Set(['paid']);

function countActiveAppointments(list) {
  if (!Array.isArray(list)) return 0;
  return list.filter((item) => ACTIVE_APPOINTMENT_STATUSES.has(item && item.status)).length;
}

function countActiveActivities(list) {
  if (!Array.isArray(list)) return 0;
  return list.filter((item) => ACTIVE_ACTIVITY_STATUSES.has(item && item.status)).length;
}

function countActiveSchedule(input) {
  const source = input || {};
  return countActiveAppointments(source.appointments) + countActiveActivities(source.activities);
}

function buildScheduleHeaderCounts(input) {
  const source = input || {};
  return {
    appointmentActiveCount: countActiveAppointments(source.appointments),
    activityActiveCount: countActiveActivities(source.activities),
  };
}

module.exports = {
  ACTIVE_APPOINTMENT_STATUSES,
  ACTIVE_ACTIVITY_STATUSES,
  countActiveAppointments,
  countActiveActivities,
  countActiveSchedule,
  buildScheduleHeaderCounts,
};
