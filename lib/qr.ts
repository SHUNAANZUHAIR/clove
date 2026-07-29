const version = 5;
const size = 17 + version * 4;
const dataCodewords = 108;
const errorCodewords = 26;

export function createQrMatrix(text: string) {
  const bytes = Array.from(Buffer.from(text, 'utf8'));
  if (bytes.length > 106) throw new Error('QR verification URL is too long');

  const bits: number[] = [0, 1, 0, 0];
  appendBits(bits, bytes.length, 8);
  bytes.forEach((byte) => appendBits(bits, byte, 8));
  for (let index = 0; index < 4 && bits.length < dataCodewords * 8; index += 1) bits.push(0);
  while (bits.length % 8) bits.push(0);
  const data: number[] = [];
  for (let index = 0; index < bits.length; index += 8) data.push(bits.slice(index, index + 8).reduce((value, bit) => (value << 1) | bit, 0));
  for (let pad = 0; data.length < dataCodewords; pad += 1) data.push(pad % 2 === 0 ? 0xec : 0x11);

  const codewords = [...data, ...reedSolomon(data, errorCodewords)];
  const matrix: Array<Array<boolean | null>> = Array.from({ length: size }, () => Array<boolean | null>(size).fill(null));
  const set = (x: number, y: number, value: boolean) => { if (x >= 0 && y >= 0 && x < size && y < size) matrix[y][x] = value; };
  const finder = (left: number, top: number) => {
    for (let y = -1; y <= 7; y += 1) for (let x = -1; x <= 7; x += 1) {
      const inPattern = x >= 0 && x <= 6 && y >= 0 && y <= 6;
      set(left + x, top + y, inPattern && (x === 0 || x === 6 || y === 0 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4)));
    }
  };
  finder(0, 0); finder(size - 7, 0); finder(0, size - 7);
  for (let index = 8; index < size - 8; index += 1) {
    if (matrix[6][index] === null) set(index, 6, index % 2 === 0);
    if (matrix[index][6] === null) set(6, index, index % 2 === 0);
  }
  for (let y = -2; y <= 2; y += 1) for (let x = -2; x <= 2; x += 1) set(30 + x, 30 + y, Math.max(Math.abs(x), Math.abs(y)) !== 1);
  set(8, size - 8, true);
  drawFormatBits(set);

  const payloadBits = codewords.flatMap((byte) => Array.from({ length: 8 }, (_, bit) => (byte >>> (7 - bit)) & 1));
  let payloadIndex = 0;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1;
    for (let vertical = 0; vertical < size; vertical += 1) {
      const y = upward ? size - 1 - vertical : vertical;
      for (let offset = 0; offset < 2; offset += 1) {
        const x = right - offset;
        if (matrix[y][x] !== null) continue;
        let value = Boolean(payloadBits[payloadIndex] || 0);
        payloadIndex += 1;
        if ((x + y) % 2 === 0) value = !value;
        set(x, y, value);
      }
    }
    upward = !upward;
  }
  return matrix as boolean[][];
}

function drawFormatBits(set: (x: number, y: number, value: boolean) => void) {
  const formatData = 1 << 3; // Error correction L, mask 0.
  let remainder = formatData;
  for (let index = 0; index < 10; index += 1) remainder = (remainder << 1) ^ (((remainder >>> 9) & 1) * 0x537);
  const format = ((formatData << 10) | remainder) ^ 0x5412;
  const bit = (index: number) => Boolean((format >>> index) & 1);
  for (let index = 0; index <= 5; index += 1) set(8, index, bit(index));
  set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
  for (let index = 9; index < 15; index += 1) set(14 - index, 8, bit(index));
  for (let index = 0; index < 8; index += 1) set(size - 1 - index, 8, bit(index));
  for (let index = 8; index < 15; index += 1) set(8, size - 15 + index, bit(index));
}

function appendBits(target: number[], value: number, length: number) {
  for (let index = length - 1; index >= 0; index -= 1) target.push((value >>> index) & 1);
}

function reedSolomon(data: number[], degree: number) {
  const exp = new Array<number>(512).fill(0);
  const log = new Array<number>(256).fill(0);
  let value = 1;
  for (let index = 0; index < 255; index += 1) {
    exp[index] = value; log[value] = index;
    value <<= 1; if (value & 0x100) value ^= 0x11d;
  }
  for (let index = 255; index < 512; index += 1) exp[index] = exp[index - 255];
  const multiply = (first: number, second: number) => first && second ? exp[log[first] + log[second]] : 0;
  let generator = [1];
  for (let index = 0; index < degree; index += 1) {
    const next = new Array<number>(generator.length + 1).fill(0);
    generator.forEach((coefficient, position) => {
      next[position] ^= coefficient;
      next[position + 1] ^= multiply(coefficient, exp[index]);
    });
    generator = next;
  }
  const result = new Array<number>(degree).fill(0);
  data.forEach((byte) => {
    const factor = byte ^ result[0];
    result.shift(); result.push(0);
    for (let index = 0; index < degree; index += 1) result[index] ^= multiply(generator[index + 1], factor);
  });
  return result;
}
