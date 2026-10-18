export function stringCall(method, a) {
  const s = String(a[0] ?? ''),
    x = a.slice(1);
  switch (method) {
    case 'length':
      return s.length;
    case 'toInt':
      return parseInt(s) || 0;
    case 'toFloat':
      return parseFloat(s) || 0;
    case 'indexOf':
      return s.indexOf(typeof x[0] === 'number' ? String.fromCharCode(x[0]) : x[0], x[1] ?? 0);
    case 'lastIndexOf':
      return s.lastIndexOf(typeof x[0] === 'number' ? String.fromCharCode(x[0]) : x[0]);
    case 'substring':
      return s.substring(x[0], x[1] ?? s.length);
    case 'charAt':
      return s.charCodeAt(x[0]) || 0;
    case 'startsWith':
      return s.startsWith(x[0]) ? 1 : 0;
    case 'endsWith':
      return s.endsWith(x[0]) ? 1 : 0;
    case 'equals':
      return s === String(x[0]) ? 1 : 0;
    case 'equalsIgnoreCase':
      return s.toLowerCase() === String(x[0]).toLowerCase() ? 1 : 0;
    case 'compareTo':
      return s < x[0] ? -1 : s > x[0] ? 1 : 0;
    case 'c_str':
    case 'toString':
      return s;
    case 'toUpperCase':
      return s.toUpperCase();
    case 'toLowerCase':
      return s.toLowerCase();
    case 'trim':
      return s.trim();
    case 'replace':
      return s
        .split(typeof x[0] === 'number' ? String.fromCharCode(x[0]) : String(x[0]))
        .join(typeof x[1] === 'number' ? String.fromCharCode(x[1]) : String(x[1]));
    case 'concat':
      return s + String(x[0]);
    case 'fromChar':
      return String.fromCharCode(Number(a[0]) & 255);
    default:
      throw Error(`Unsupported String method ${method}`);
  }
}
