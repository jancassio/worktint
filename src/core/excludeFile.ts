function lines(contents: string): string[] {
  return contents.length === 0 ? [] : contents.replace(/\n$/, '').split('\n');
}

export function hasLine(contents: string, line: string): boolean {
  return lines(contents).includes(line);
}

export function ensureLine(contents: string, line: string): string {
  if (hasLine(contents, line)) return contents;
  const arr = lines(contents);
  arr.push(line);
  return arr.join('\n') + '\n';
}

export function removeLine(contents: string, line: string): string {
  const arr = lines(contents).filter((l) => l !== line);
  return arr.length ? arr.join('\n') + '\n' : '';
}
