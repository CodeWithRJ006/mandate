export function getSimilarity(s1: string, s2: string): number {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const getBigrams = (str: string) => {
    const bigrams = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.substring(i, i + 2));
    }
    return bigrams;
  };
  
  const norm1 = normalize(s1);
  const norm2 = normalize(s2);
  
  if (norm1 === norm2) return 1;
  if (norm1.length < 2 || norm2.length < 2) return 0;
  
  const bg1 = getBigrams(norm1);
  const bg2 = getBigrams(norm2);
  
  let intersection = 0;
  for (const bg of bg1) {
    if (bg2.has(bg)) intersection++;
  }
  
  return (2.0 * intersection) / (bg1.size + bg2.size);
}
