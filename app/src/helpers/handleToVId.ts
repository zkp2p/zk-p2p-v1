type HandleIdMapping = {
  [handle: string]: string;
};

const handleIdMapping: HandleIdMapping = {
  "Brian-Weickmann": "1204313728745472326",
  "Richard-Liang-2": "1168869611798528966",
  "Alex-Soong": "645716473020416186"
};

// TODO: Retrieve by scraping https://account.venmo.com/u/[XXXX]
export function getIdFromHandle(handle: string): string | undefined {
  return handleIdMapping[handle];
}

// TODO: Retrieve by scraping https://venmo.com/code?user_id=[XXXX]
export function getHandleFromId(id: string): string | undefined {
  const entries = Object.entries(handleIdMapping);
  const match = entries.find(([_, value]) => value === id);
  if (match) {
    return match[0];
  }
  return undefined;
}
