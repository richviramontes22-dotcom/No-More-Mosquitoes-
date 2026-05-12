export function stringifyError(err: any): string {
  if (!err) return "Unknown error occurred";
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;

  if (typeof err === 'object') {
    // PostgREST/Supabase specific fields (direct)
    const msg = err.message || err.details || err.hint || err.error_description || err.code || err.statusText;
    if (typeof msg === 'string') return msg;

    // Check for nested error objects (some Supabase responses have { error: { message: ... } })
    if (err.error && typeof err.error === 'object') {
      const nestedMsg = err.error.message || err.error.details || err.error.hint || err.error.code;
      if (typeof nestedMsg === 'string') return nestedMsg;
    }

    // Try to stringify, but avoid returning empty object
    try {
      const stringified = JSON.stringify(err);
      if (stringified === '{}') {
        // If it's an object with no enumerable properties, try to get anything from it
        const keys = Object.getOwnPropertyNames(err);
        if (keys.length > 0) {
          const parts = keys.map(k => `${k}: ${err[k]}`);
          return parts.join(', ');
        }
        return String(err);
      }
      return stringified;
    } catch (e) {
      return String(err);
    }
  }

  return String(err);
}
