export const generateId = (prefix: string = 'id'): string => {
  const timestamp = Date.now().toString(36);
  let randomPart = '';
  
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    randomPart = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  } else {
    randomPart = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 6);
  }
  
  return `${prefix}_${timestamp}_${randomPart}`;
};
