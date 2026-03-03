import Papa from 'papaparse';

export interface RawConnection {
  firstName: string;
  lastName: string;
  url: string;
  email: string;
  company: string;
  position: string;
  connectedOn: string;
}

export function parseConnections(csvText: string): RawConnection[] {
  // Skip the 2-line "Notes:" header that LinkedIn adds
  const lines = csvText.split('\n');
  let startIdx = 0;
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    if (lines[i].startsWith('First Name,')) {
      startIdx = i;
      break;
    }
  }

  const cleanedCsv = lines.slice(startIdx).join('\n');

  const result = Papa.parse<Record<string, string>>(cleanedCsv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  });

  return result.data
    .filter(row => row['First Name'] || row['Last Name'])
    .map(row => ({
      firstName: row['First Name']?.trim() || '',
      lastName: row['Last Name']?.trim() || '',
      url: row['URL']?.trim() || '',
      email: row['Email Address']?.trim() || '',
      company: row['Company']?.trim() || '',
      position: row['Position']?.trim() || '',
      connectedOn: row['Connected On']?.trim() || '',
    }));
}
