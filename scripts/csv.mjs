// Supabase table exports use RFC 4180 CSV. Keep quoted newlines and empty nullable cells.
export function parseCsv(source) {
  const rows = [];
  let row = [], cell = '', quoted = false, quoteClosed = false;
  const finishCell = () => { row.push(cell === '' && !quoteClosed ? null : cell); cell = ''; quoteClosed = false; };
  source = source.replace(/^\uFEFF/, '');
  // Lovable exports use semicolons; Supabase exports use commas.
  const delimiter = source.slice(0, source.indexOf('\n')).includes(';') ? ';' : ',';
  for (let i = 0; i < source.length; i++) {
    const character = source[i];
    if (quoted) {
      if (character === '"' && source[i + 1] === '"') { cell += '"'; i++; }
      else if (character === '"') { quoted = false; quoteClosed = true; }
      else cell += character;
    } else if (character === '"') {
      if (cell || quoteClosed) throw new Error('Invalid CSV quoting');
      quoted = true;
    } else if (character === delimiter) { finishCell(); }
    else if (character === '\n' || character === '\r') {
      finishCell(); rows.push(row); row = [];
      if (character === '\r' && source[i + 1] === '\n') i++;
    } else {
      if (quoteClosed) throw new Error('Unexpected CSV data after closing quote');
      cell += character;
    }
  }
  if (quoted) throw new Error('Unterminated CSV field');
  if (cell || row.length || quoteClosed) { finishCell(); rows.push(row); }
  const headings = rows.shift();
  if (!headings || !headings.length || headings.some(key => !key) || new Set(headings).size !== headings.length) throw new Error('Invalid CSV header');
  return rows.filter(row => !(row.length === 1 && row[0] == null)).map(row => {
    if (row.length !== headings.length) throw new Error('CSV column count mismatch');
    return Object.fromEntries(headings.map((key, i) => [key, row[i]]));
  });
}
