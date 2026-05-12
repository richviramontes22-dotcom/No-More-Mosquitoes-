const REGRID_API_KEY = process.env.REGRID_API_KEY?.trim();
if (REGRID_API_KEY && REGRID_API_KEY.includes('.')) {
  const parts = REGRID_API_KEY.split('.');
  if (parts.length >= 2) {
    try {
      const payload = Buffer.from(parts[1], 'base64').toString();
      console.log(`Payload: ${payload}`);
    } catch (err) {
      console.error("Failed to decode payload");
    }
  }
} else {
  console.log("Not a JWT or key missing");
}
