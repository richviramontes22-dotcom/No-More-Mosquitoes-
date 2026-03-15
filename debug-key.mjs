const REGRID_API_KEY = process.env.REGRID_API_KEY?.trim();
if (REGRID_API_KEY) {
  console.log(`Length: ${REGRID_API_KEY.length}`);
  console.log(`Start: ${REGRID_API_KEY.substring(0, 10)}`);
  console.log(`End: ${REGRID_API_KEY.substring(REGRID_API_KEY.length - 10)}`);
} else {
  console.log("Key is missing");
}
