// Offline-safe 12-char Health ID generator: CH + DDDD + DEV + SSS (all base36 uppercase)
// DDDD = days since 2020-01-01 (base36, 4 chars)
// DEV  = persistent per-device random code (3 chars)
// SSS  = per-day sequence per device (3 chars)
// Capacity: 46,656 IDs per device per day

const EPOCH_2020 = Date.UTC(2020, 0, 1);
const MS_PER_DAY = 86400000;
const DEVICE_KEY = 'healthid_device_v1';
const SEQ_PREFIX = 'healthid_seq_v1_';

function getDayNumber() {
  return Math.floor((Date.now() - EPOCH_2020) / MS_PER_DAY);
}

function getDeviceCode() {
  let code = localStorage.getItem(DEVICE_KEY);
  if (!code) {
    code = Math.floor(Math.random() * 36 ** 3)
      .toString(36)
      .toUpperCase()
      .padStart(3, '0');
    localStorage.setItem(DEVICE_KEY, code);
  }
  return code;
}

function nextSequence(dayNum) {
  const key = SEQ_PREFIX + dayNum;
  let seq = parseInt(localStorage.getItem(key) || '0', 10);
  if (seq >= 36 ** 3) {
    throw new Error('Daily HealthID capacity exceeded for this device');
  }
  localStorage.setItem(key, String(seq + 1));
  return seq;
}

export function generateHealthId() {
  const dayNum = getDayNumber();
  const dayPart = dayNum.toString(36).toUpperCase().padStart(4, '0');
  const devPart = getDeviceCode();
  const seq = nextSequence(dayNum);
  const seqPart = seq.toString(36).toUpperCase().padStart(3, '0');
  return 'CH' + dayPart + devPart + seqPart; // 12 chars
}

export function peekNextHealthId() {
  // Non-incrementing preview (sequence not advanced)
  const dayNum = getDayNumber();
  const dayPart = dayNum.toString(36).toUpperCase().padStart(4, '0');
  const devPart = getDeviceCode();
  const key = SEQ_PREFIX + dayNum;
  let seq = parseInt(localStorage.getItem(key) || '0', 10);
  const seqPart = seq.toString(36).toUpperCase().padStart(3, '0');
  return 'CH' + dayPart + devPart + seqPart;
}
