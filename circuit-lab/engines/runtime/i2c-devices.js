export const bcd = v => ((Math.floor(v / 10) << 4) | (v % 10)) & 255;

export const unbcd = b => (b >> 4) * 10 + (b & 15);

export function mpuInit(st) {
  if (!st.regs) {
    st.regs = new Array(128).fill(0);
    st.regs[0x6b] = 0x40;
    st.ptr = 0;
  }
}

export function mpuReg(st, r, c) {
  if (r === 0x75) return 0x68;
  if (r >= 0x3b && r <= 0x48) {
    if (st.regs[0x6b] & 0x40) return 0;
    const afs = [16384, 8192, 4096, 2048][(st.regs[0x1c] >> 3) & 3],
      gfs = [131, 65.5, 32.8, 16.4][(st.regs[0x1b] >> 3) & 3],
      p = c.params;
    const vals = [
      p.ax * afs,
      p.ay * afs,
      p.az * afs,
      (p.temp - 36.53) * 340,
      p.gx * gfs,
      p.gy * gfs,
      p.gz * gfs,
    ].map(v => Math.max(-32768, Math.min(32767, Math.round(v))) & 0xffff);
    const v = vals[Math.floor((r - 0x3b) / 2)];
    return (r - 0x3b) % 2 === 0 ? v >> 8 : v & 255;
  }
  return st.regs[r] ?? 0;
}

export function rtcInit(st, c, sim) {
  if (st.base === undefined) {
    const d = new Date(String(c.params.start).replace(/Z?$/, 'Z'));
    st.base = Number.isFinite(d.getTime()) ? d.getTime() : Date.UTC(2026, 0, 1, 12);
    st.setAt = sim.time;
    st.ptr = 0;
    st.regs = new Array(19).fill(0);
  }
}

export function rtcNow(st, sim) {
  return new Date(st.base + (sim.time - st.setAt));
}

export function rtcReg(st, r, c, sim) {
  const d = rtcNow(st, sim);
  switch (r) {
    case 0:
      return bcd(d.getUTCSeconds());
    case 1:
      return bcd(d.getUTCMinutes());
    case 2:
      return bcd(d.getUTCHours());
    case 3:
      return d.getUTCDay() + 1;
    case 4:
      return bcd(d.getUTCDate());
    case 5:
      return bcd(d.getUTCMonth() + 1) | (d.getUTCFullYear() >= 2100 ? 0x80 : 0);
    case 6:
      return bcd(d.getUTCFullYear() % 100);
    case 0x11:
      return Math.floor(c.params.temp) & 255;
    case 0x12:
      return (Math.round((c.params.temp % 1) * 4) & 3) << 6;
    default:
      return st.regs[r] ?? 0;
  }
}

export const I2C_DEVICES = {
  oled: {address: c => c.params.address},
  lcd: {address: c => c.params.address},
  mpu6050: {
    address: (c, circuit) => circuit.components[c.id]?.address ?? 0x68,
    write(st, bytes) {
      mpuInit(st);
      if (!bytes.length) return;
      st.ptr = bytes[0] & 127;
      for (let i = 1; i < bytes.length; i++) {
        st.regs[st.ptr] = bytes[i] & 255;
        st.ptr = (st.ptr + 1) & 127;
      }
    },
    read(st, n, c) {
      mpuInit(st);
      const out = [];
      for (let i = 0; i < n; i++) {
        out.push(mpuReg(st, st.ptr, c));
        st.ptr = (st.ptr + 1) & 127;
      }
      return out;
    },
  },
  ds3231: {
    address: () => 0x68,
    write(st, bytes, c, sim) {
      rtcInit(st, c, sim);
      if (!bytes.length) return;
      st.ptr = bytes[0] % 19;
      const data = bytes.slice(1);
      if (st.ptr === 0 && data.length >= 7) {
        const [s, m, h, , date, mon, y] = data;
        st.base = Date.UTC(
          2000 + unbcd(y),
          unbcd(mon & 0x1f) - 1,
          unbcd(date),
          unbcd(h & 0x3f),
          unbcd(m),
          unbcd(s & 0x7f)
        );
        st.setAt = sim.time;
        st.ptr = 7;
        data.splice(0, 7);
      }
      for (const b of data) {
        st.regs[st.ptr] = b;
        st.ptr = (st.ptr + 1) % 19;
      }
    },
    read(st, n, c, sim) {
      rtcInit(st, c, sim);
      const out = [];
      for (let i = 0; i < n; i++) {
        out.push(rtcReg(st, st.ptr, c, sim));
        st.ptr = (st.ptr + 1) % 19;
      }
      return out;
    },
  },
};

export const i2cAddress = (c, circuit) => I2C_DEVICES[c.type]?.address(c, circuit);
