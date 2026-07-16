const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const settlePath = path.join(
  __dirname,
  '../cloudfunctions/adminListAppointments/settleNoShow.js',
);
const { settleNoShowAppointments } = require(settlePath);

function createMockDb({ updateErrorIds = new Set(), removeErrorIds = new Set() } = {}) {
  const updates = [];
  const removes = [];
  const occupancyByAppointment = new Map();

  return {
    updates,
    removes,
    occupancyByAppointment,
    seedOccupancies(appointmentId, rows) {
      occupancyByAppointment.set(appointmentId, rows);
    },
    collection(name) {
      if (name === 'appointments') {
        return {
          doc(id) {
            return {
              async update({ data }) {
                if (updateErrorIds.has(id)) {
                  throw new Error(`update failed ${id}`);
                }
                updates.push({ id, data });
              },
            };
          },
        };
      }
      if (name === 'seat_occupancies') {
        return {
          where({ appointmentId }) {
            return {
              limit() {
                return {
                  async get() {
                    return {
                      data: occupancyByAppointment.get(appointmentId) || [],
                    };
                  },
                };
              },
            };
          },
          doc(id) {
            return {
              async remove() {
                if (removeErrorIds.has(id)) {
                  throw new Error(`remove failed ${id}`);
                }
                removes.push(id);
              },
            };
          },
        };
      }
      throw new Error(`unexpected collection ${name}`);
    },
  };
}

describe('settleNoShowAppointments', () => {
  it('marks confirmed timeout as no_show, clears seat fields, removes reserved occ', async () => {
    const db = createMockDb();
    db.seedOccupancies('a1', [
      { _id: 'occ1', type: 'reserved', appointmentId: 'a1' },
      { _id: 'occ2', type: 'arrived', appointmentId: 'a1' },
    ]);
    const start = new Date('2026-07-16T10:00:00+08:00').getTime();
    const appointments = [
      {
        _id: 'a1',
        status: 'confirmed',
        appointmentDate: '2026-07-16',
        timeSlots: ['10:00-12:00'],
        seatIds: ['F1-A1', 'F1-A2'],
        tableCode: 'F1-A',
      },
    ];

    await settleNoShowAppointments(db, appointments, start + 16 * 60 * 1000);

    assert.equal(appointments[0].status, 'no_show');
    assert.deepEqual(appointments[0].seatIds, []);
    assert.equal(appointments[0].tableCode, '');
    assert.equal(db.updates.length, 1);
    assert.deepEqual(db.updates[0].data.seatIds, []);
    assert.equal(db.updates[0].data.tableCode, '');
    assert.deepEqual(db.removes, ['occ1', 'occ2']);
  });

  it('reconciles already no_show leftovers by clearing seats and reserved occ', async () => {
    const db = createMockDb();
    db.seedOccupancies('a2', [
      { _id: 'occ-left', type: 'reserved', appointmentId: 'a2' },
    ]);
    const appointments = [
      {
        _id: 'a2',
        status: 'no_show',
        appointmentDate: '2026-07-16',
        timeSlots: ['12:00-14:00'],
        seatIds: ['F1-B1'],
        tableCode: 'F1-B',
      },
    ];

    await settleNoShowAppointments(db, appointments, Date.now());

    assert.deepEqual(appointments[0].seatIds, []);
    assert.equal(appointments[0].tableCode, '');
    assert.equal(db.updates.length, 1);
    assert.deepEqual(db.updates[0].data.seatIds, []);
    assert.deepEqual(db.removes, ['occ-left']);
  });

  it('completes arrived holds after last slot ends and clears arrived occ', async () => {
    const db = createMockDb();
    db.seedOccupancies('a3', [
      { _id: 'occ-a', type: 'arrived', appointmentId: 'a3' },
    ]);
    const end = new Date('2026-07-16T18:00:00+08:00').getTime();
    const appointments = [
      {
        _id: 'a3',
        status: 'arrived',
        appointmentDate: '2026-07-16',
        timeSlots: ['10:00-12:00', '16:00-18:00'],
        seatIds: ['F1-A1', 'F1-A2'],
        tableCode: 'F1-A',
      },
    ];

    await settleNoShowAppointments(db, appointments, end);

    assert.equal(appointments[0].status, 'completed');
    assert.deepEqual(appointments[0].seatIds, []);
    assert.equal(appointments[0].tableCode, '');
    assert.equal(db.updates[0].data.status, 'completed');
    assert.deepEqual(db.removes, ['occ-a']);
  });
});
