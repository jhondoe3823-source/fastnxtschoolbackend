/**
 * Attendance classification helpers for Online Classes.
 * Run: node --test src/tests/online-class-attendance.logic.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { encryptSecret, decryptSecret } = require('../utils/token-crypto');

// Mirror classifyAttendance from attendance-sync.service (kept local for unit purity).
function classifyAttendance({ attendedMinutes, durationMinutes, joinTime, scheduledAt, rules }) {
  const required = Math.ceil(durationMinutes * rules.presentRatio);
  if (attendedMinutes <= 0) return 'Absent';
  if (attendedMinutes < required) return 'Partial';
  if (joinTime && scheduledAt) {
    const lateAfter = new Date(scheduledAt).getTime() + rules.lateGraceMinutes * 60_000;
    if (new Date(joinTime).getTime() > lateAfter) return 'Late';
  }
  return 'Present';
}

const rules = { presentRatio: 0.75, lateGraceMinutes: 10 };

describe('online class attendance classification', () => {
  it('marks Present when duration threshold met and on-time', () => {
    const scheduledAt = new Date('2026-11-26T10:00:00Z');
    const status = classifyAttendance({
      attendedMinutes: 40,
      durationMinutes: 45,
      joinTime: new Date('2026-11-26T10:02:00Z'),
      scheduledAt,
      rules,
    });
    assert.equal(status, 'Present');
  });

  it('marks Late when joined after grace', () => {
    const scheduledAt = new Date('2026-11-26T10:00:00Z');
    const status = classifyAttendance({
      attendedMinutes: 40,
      durationMinutes: 45,
      joinTime: new Date('2026-11-26T10:20:00Z'),
      scheduledAt,
      rules,
    });
    assert.equal(status, 'Late');
  });

  it('marks Partial below threshold', () => {
    const status = classifyAttendance({
      attendedMinutes: 20,
      durationMinutes: 45,
      joinTime: new Date('2026-11-26T10:00:00Z'),
      scheduledAt: new Date('2026-11-26T10:00:00Z'),
      rules,
    });
    assert.equal(status, 'Partial');
  });

  it('marks Absent with zero minutes', () => {
    const status = classifyAttendance({
      attendedMinutes: 0,
      durationMinutes: 45,
      joinTime: null,
      scheduledAt: new Date('2026-11-26T10:00:00Z'),
      rules,
    });
    assert.equal(status, 'Absent');
  });
});

describe('token crypto', () => {
  it('round-trips secrets', () => {
    const plain = 'ya29.test-access-token';
    const enc = encryptSecret(plain);
    assert.notEqual(enc, plain);
    assert.equal(decryptSecret(enc), plain);
  });
});
